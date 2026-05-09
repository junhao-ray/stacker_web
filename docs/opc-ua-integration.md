# OPC UA 接入文档

本文档定义种子立体仓库出库系统与 PLC 的 OPC UA 接入方式。

目标架构是：Web 后端负责订单、库存、库位、坐标计算和任务调度；PLC 只负责运动控制、安全联锁、IO 控制和动作完成反馈。

## 1. 系统边界

### Web 后端负责

- 接收订单，例如 A 2 包、B 3 包、C 1 包。
- 校验库存并锁定库存。
- 根据商品、规格、库位和标定表计算吸取坐标。
- 将订单拆成单包执行步骤。
- 通过 OPC UA 逐步下发单包取放命令。
- 等待 PLC 完成反馈。
- 更新任务进度、库存、日志和异常状态。
- 根据 PLC 反馈决定继续、重试、换库位或转人工处理。

### PLC 负责

- 轴使能、回零、定位、速度和加减速控制。
- 根据 Web 下发的目标坐标执行单包取放动作。
- 控制伸缩机构、真空吸附、释放动作。
- 检查安全门、急停、限位、真空压力、到位信号。
- 管理暂停、继续、复位、报警停机。
- 通过 OPC UA 返回当前状态、完成信号和错误信息。

### OPC UA 网关负责

- 连接 PLC OPC UA Server。
- 将 Web 后端命令写入 PLC 变量。
- 读取 PLC 状态和 ACK 变量。
- 做命令流水号和超时校验。

## 2. 控制原则

Web 不直接控制底层动作，例如 `MoveX`、`VacuumOn`、`CylinderOut`。

Web 只下发动作单元：

```text
PickToBin: 到指定 X/Y 坐标吸取一包并放入中转箱
ReleaseBin: 中转箱移动到释放位并释放
Home: 回原点
Pause: 暂停
Resume: 继续
ResetAlarm: 复位报警
```

PLC 收到 `PickToBin` 后，自主完成完整动作链：

```text
安全检查
-> X/Y 移动到吸取坐标
-> 等待到位
-> 吸取机构伸出
-> 真空开启
-> 真空压力确认
-> 吸取机构缩回
-> 移动到中转箱投放位
-> 真空关闭并释放
-> 确认释放完成
-> 返回完成
```

## 3. 命令码

| 命令码 | 名称 | 说明 |
|---:|---|---|
| 100 | `PickToBin` | 到目标 X/Y 坐标取一包并放入中转箱 |
| 110 | `ReleaseBin` | 中转箱移动到释放位并释放 |
| 120 | `Pause` | 暂停当前动作 |
| 130 | `Resume` | 继续当前动作 |
| 140 | `Home` | 回原点 |
| 150 | `ResetAlarm` | 复位报警 |

## 4. 状态码

| 状态码 | 名称 | 说明 |
|---:|---|---|
| 0 | `Idle` | 待命，可接收新动作 |
| 1 | `Running` | 运行中 |
| 2 | `Paused` | 已暂停 |
| 3 | `Alarm` | 报警 |
| 4 | `Homing` | 回原点中，可选 |
| 5 | `Manual` | 手动模式，可选 |

## 5. 侧别约定

如果设备仍需要区分货架侧别，使用以下约定：

| 值 | 名称 | 说明 |
|---:|---|---|
| 0 | `None` | 不指定 |
| 1 | `Left` | 左侧/上侧 |
| 2 | `Right` | 右侧/下侧 |

PLC 的主要运动目标以 `Target_X` 和 `Target_Y` 为准，`Target_Side` 只作为辅助信息或机构朝向选择。

## 6. 最小 OPC UA 变量表

### 6.1 命令变量

| 变量名 | 类型 | 方向 | 说明 |
|---|---|---|---|
| `Cmd_Seq` | `UInt32` | Web -> PLC | 命令流水号，每次命令递增 |
| `Cmd_Code` | `UInt32` | Web -> PLC | 命令码 |
| `Cmd_Trigger` | `Boolean` | Web -> PLC | 命令触发脉冲，上升沿有效 |

### 6.2 目标变量

| 变量名 | 类型 | 方向 | 说明 |
|---|---|---|---|
| `Target_X` | `Double` | Web -> PLC | X 轴目标坐标，单位建议 mm |
| `Target_Y` | `Double` | Web -> PLC | Y 轴目标坐标，单位建议 mm |
| `Target_Side` | `UInt32` | Web -> PLC | 0 不指定，1 左/上侧，2 右/下侧 |
| `Target_Qty` | `UInt32` | Web -> PLC | 本次动作数量，当前建议固定为 1 |

### 6.3 追踪变量

这些变量不参与 PLC 运动计算，只用于 HMI、日志和排查问题。

| 变量名 | 类型 | 方向 | 说明 |
|---|---|---|---|
| `Trace_TaskNo` | `String` | Web -> PLC | 出库任务号 |
| `Trace_OrderNo` | `String` | Web -> PLC | 订单号 |
| `Trace_StepId` | `String` | Web -> PLC | 当前单包步骤 ID |
| `Trace_ProductCode` | `String` | Web -> PLC | 商品编码 |
| `Trace_SlotId` | `String` | Web -> PLC | 库位号 |

### 6.4 ACK 变量

| 变量名 | 类型 | 方向 | 说明 |
|---|---|---|---|
| `Ack_Seq` | `UInt32` | PLC -> Web | PLC 已处理的命令流水号 |
| `Ack_Code` | `UInt32` | PLC -> Web | PLC 已处理的命令码 |
| `Ack_Result` | `String` | PLC -> Web | `ok`、`busy`、`alarm`、`invalid_target`、`rejected` |

### 6.5 状态变量

| 变量名 | 类型 | 方向 | 说明 |
|---|---|---|---|
| `Machine_State` | `UInt32` | PLC -> Web | 设备状态码 |
| `Step_Busy` | `Boolean` | PLC -> Web | 当前单包动作执行中 |
| `Step_Done` | `Boolean` | PLC -> Web | 当前单包动作完成 |
| `Current_Seq` | `UInt32` | PLC -> Web | 当前正在执行的命令流水号 |
| `Current_StepId` | `String` | PLC -> Web | 当前步骤 ID |
| `Actual_X` | `Double` | PLC -> Web | 当前 X 坐标 |
| `Actual_Y` | `Double` | PLC -> Web | 当前 Y 坐标 |
| `Alarm` | `Boolean` | PLC -> Web | 是否报警 |
| `ErrorCode` | `String` | PLC -> Web | 错误码 |
| `ErrorMessage` | `String` | PLC -> Web | 错误描述 |

## 7. 推荐扩展变量

这些变量不是第一版必须，但建议 PLC 预留，便于 Web 后续做数字孪生和诊断。

| 变量名 | 类型 | 方向 | 说明 |
|---|---|---|---|
| `Heartbeat` | `UInt32` | PLC -> Web | PLC 心跳计数 |
| `Motion_Phase` | `UInt32` | PLC -> Web | 当前动作阶段 |
| `Vacuum_On` | `Boolean` | PLC -> Web | 真空开启状态 |
| `Vacuum_OK` | `Boolean` | PLC -> Web | 真空压力确认 |
| `Cylinder_Extended` | `Boolean` | PLC -> Web | 吸取机构伸出到位 |
| `Cylinder_Retracted` | `Boolean` | PLC -> Web | 吸取机构缩回到位 |
| `AxisX_InPosition` | `Boolean` | PLC -> Web | X 轴到位 |
| `AxisY_InPosition` | `Boolean` | PLC -> Web | Y 轴到位 |
| `Safety_OK` | `Boolean` | PLC -> Web | 安全条件满足 |
| `Door_Closed` | `Boolean` | PLC -> Web | 安全门关闭 |
| `EStop_OK` | `Boolean` | PLC -> Web | 急停正常 |

建议 `Motion_Phase` 定义：

| 阶段码 | 名称 | 说明 |
|---:|---|---|
| 0 | `None` | 无动作 |
| 10 | `SafetyCheck` | 安全检查 |
| 20 | `MoveToPick` | 移动到吸取点 |
| 30 | `WaitInPosition` | 等待到位 |
| 40 | `Extend` | 吸取机构伸出 |
| 50 | `VacuumOn` | 真空开启 |
| 60 | `VacuumCheck` | 真空确认 |
| 70 | `Retract` | 吸取机构缩回 |
| 80 | `MoveToBin` | 移动到中转箱 |
| 90 | `Release` | 释放 |
| 100 | `Done` | 完成 |
| 900 | `Error` | 异常 |

## 8. 握手机制

### 8.1 Web 下发命令

Web 写入目标参数和追踪参数：

```text
Target_X = 1350.25
Target_Y = 420.80
Target_Side = 1
Target_Qty = 1
Trace_TaskNo = CK20260429001
Trace_OrderNo = SO-10001
Trace_StepId = STEP-001
Trace_ProductCode = A
Trace_SlotId = left-03-02
```

然后写入命令：

```text
Cmd_Code = 100
Cmd_Seq = 25
Cmd_Trigger = true
```

保持一个短脉冲后置回：

```text
Cmd_Trigger = false
```

建议脉冲宽度：100 ms 到 200 ms。

### 8.2 PLC 接收命令

PLC 检测 `Cmd_Trigger` 上升沿后：

1. 判断 `Cmd_Seq` 是否为新命令。
2. 判断设备是否允许接收命令。
3. 锁存 `Cmd_Code`、`Target_X`、`Target_Y`、`Trace_StepId`。
4. 写入：

```text
Current_Seq = Cmd_Seq
Current_StepId = Trace_StepId
Ack_Seq = Cmd_Seq
Ack_Code = Cmd_Code
Ack_Result = "ok"
Step_Busy = true
Step_Done = false
Machine_State = 1
```

如果不能接收，返回：

```text
Ack_Seq = Cmd_Seq
Ack_Code = Cmd_Code
Ack_Result = "busy" 或 "alarm" 或 "invalid_target"
```

### 8.3 PLC 完成动作

动作完成后：

```text
Step_Busy = false
Step_Done = true
Machine_State = 0
Motion_Phase = 100
```

Web 读取到 `Step_Done = true` 且 `Current_Seq` 等于本次命令流水号后，才认为当前包完成，然后下发下一包。

### 8.4 Web 下发下一步前的复位

建议 PLC 在收到下一条命令时自动清除上一条 `Step_Done`。

也可以由 Web 在下发下一条命令前写入新 `Cmd_Seq`，PLC 在锁存新命令时执行：

```text
Step_Done = false
Step_Busy = true
```

## 9. 单包动作 PLC 状态机建议

`PickToBin` 的 PLC 内部状态机建议：

```text
S0 Idle
  等待 PickToBin 命令

S10 SafetyCheck
  检查急停、安全门、气压、伺服使能、报警状态

S20 MoveToPick
  X/Y 轴移动到 Target_X / Target_Y

S30 WaitPickPosition
  等待 X/Y 到位

S40 Extend
  吸取机构伸出

S50 VacuumOn
  打开真空

S60 VacuumCheck
  检查真空压力，失败可按 PLC 策略重试

S70 Retract
  吸取机构缩回

S80 MoveToBin
  移动到中转箱投放位置

S90 Release
  关闭真空，释放包装袋

S100 Done
  Step_Done = true，Step_Busy = false

S900 Alarm
  Alarm = true，Machine_State = 3，等待复位
```

## 10. 出库示例

订单：

```text
A 2 包
B 3 包
C 1 包
```

Web 后端拆成 6 个单包步骤：

| 步骤 | 商品 | 数量 | X | Y | 库位 |
|---:|---|---:|---:|---:|---|
| 1 | A | 1 | 1350.25 | 420.80 | `left-03-02` |
| 2 | A | 1 | 1350.25 | 420.80 | `left-03-02` |
| 3 | B | 1 | 1880.00 | 610.50 | `right-08-04` |
| 4 | B | 1 | 1880.00 | 610.50 | `right-08-04` |
| 5 | B | 1 | 1880.00 | 610.50 | `right-08-04` |
| 6 | C | 1 | 2520.75 | 760.20 | `left-12-05` |

Web 逐包下发：

```text
Step 1 -> PickToBin -> 等 PLC Step_Done
Step 2 -> PickToBin -> 等 PLC Step_Done
Step 3 -> PickToBin -> 等 PLC Step_Done
Step 4 -> PickToBin -> 等 PLC Step_Done
Step 5 -> PickToBin -> 等 PLC Step_Done
Step 6 -> PickToBin -> 等 PLC Step_Done
```

6 包全部完成后，Web 下发：

```text
Cmd_Code = 110
Cmd_Seq = 7
Cmd_Trigger = true
```

PLC 执行 `ReleaseBin`，完成后 Web 标记整单出库完成。

## 11. 坐标表建议

Web 后端需要维护库位和包装规格到吸取坐标的映射表。

推荐字段：

| 字段 | 说明 |
|---|---|
| `slotId` | 库位号 |
| `productCode` | 商品编码，可选 |
| `specId` | 包装规格 ID |
| `side` | 侧别 |
| `row` | 行 |
| `column` | 列 |
| `pickX` | 吸取 X 坐标 |
| `pickY` | 吸取 Y 坐标 |
| `offsetX` | 商品或规格 X 修正量 |
| `offsetY` | 商品或规格 Y 修正量 |
| `enabled` | 是否启用 |
| `updatedAt` | 最后标定时间 |

最终下发给 PLC 的坐标建议由 Web 计算：

```text
Target_X = pickX + offsetX + calibrationOffsetX
Target_Y = pickY + offsetY + calibrationOffsetY
```

PLC 不再计算包装袋偏移，只使用最终坐标运动。

## 12. 异常处理建议

### PLC 应返回的常见错误

| Ack_Result | ErrorCode | 说明 |
|---|---|---|
| `busy` | `PLC_BUSY` | 设备正在执行其他动作 |
| `alarm` | `PLC_ALARM` | 设备报警中 |
| `invalid_target` | `TARGET_OUT_OF_RANGE` | 目标坐标超出软限位 |
| `rejected` | `SAFETY_NOT_READY` | 安全条件不满足 |
| `rejected` | `VACUUM_FAILED` | 真空吸取失败 |
| `rejected` | `AXIS_TIMEOUT` | 轴到位超时 |

### Web 处理策略

- `busy`: 稍后重试或等待设备空闲。
- `alarm`: 停止当前任务，提示人工处理。
- `invalid_target`: 禁止执行，检查坐标表。
- `VACUUM_FAILED`: 可按策略重试当前包，或切换备用库位。
- `AXIS_TIMEOUT`: 停止任务，进入设备异常处理。

## 13. NodeId 配置建议

当前项目的 OPC 网关通过配置文件映射 NodeId：

```text
services/opc-gateway/config/plc-config.json
```

PLC 完成变量创建后，需要将每个 OPC UA 变量的 NodeId 填入该配置文件。

如果使用西门子、欧姆龙、倍福等不同 PLC，NodeId 形式可能不同，例如：

```text
ns=3;s="DB_OPC"."Cmd_Seq"
ns=3;s="DB_OPC"."Target_X"
ns=3;s="DB_OPC"."Machine_State"
```

实际 NodeId 以 PLC OPC UA Server 暴露结果为准。

## 14. 联调检查清单

1. OPC UA Server 可连接。
2. Web 网关能读取 `Machine_State`。
3. Web 写入 `Cmd_Seq`、`Cmd_Code`、`Cmd_Trigger` 后，PLC 能检测到上升沿。
4. PLC 能写回 `Ack_Seq`、`Ack_Code`、`Ack_Result`。
5. Web 下发 `PickToBin` 后，PLC 能锁存 `Target_X`、`Target_Y`。
6. PLC 执行完成后能置位 `Step_Done`。
7. Web 能识别当前步骤完成并下发下一步。
8. `ReleaseBin` 能完成最终释放。
9. 报警时 `Alarm`、`ErrorCode`、`ErrorMessage` 能正确返回。
10. 急停、安全门、限位、真空失败等异常不会被 Web 命令绕过。
