# 协作流程

以 main 保存可回溯的基线。本次起点为未完成的 V8 快照；标签 v8-dev-snapshot 对应首次交接。dev 汇总日常开发；frontend-redesign 用于前端改版。单项开发从相应分支切出 feature/功能名 或 fix/问题名。公开参与者可以 Fork 后提出 Pull Request。

## 日常提交

1. 同步目标分支并建立自己的分支。每个 PR 聚焦同一功能，提交标题可用 feat、fix、style、docs 或 test 前缀。
2. 前端改动附桌面和窄屏实拍，写明测试的是合成预览还是真实酒馆。说明键盘导航和颜色以外的状态标记。
3. 影响接口、存档或世界书时，说明字段变化、旧聊天行为和迁移方式。源文件、依赖和对应生成物一起提交，附上测试命令及其结果。
4. 创建 PR，说明复现步骤、改动和仍待验收之处。重要修改经 Owner 审核后合并到 main。

## Owner 操作

在仓库 Settings → Collaborators → Add people 输入 GitHub 用户名。对个人账号名下的公开仓库，接受邀请的 collaborator 获得写入能力；组织仓库可在角色菜单明确选择 Write。无需授予 Admin。没有被邀请的人使用 Fork 和 PR。

main 的保护设置位于 Settings → Branches 或 Rules → Rulesets。启用通过 PR、至少一条批准、Code Owner 复核、更新后重新审核、禁止强推与删除。仓库中的 CODEOWNERS 指向 Owner，这一文件须配合 GitHub 服务端保护生效。GitHub 不允许作者批准自己的 PR；只有一位 Code Owner 时，Owner 自己提交到 main 的流程需要事先安排。勿把审批说明当作已生效的远端保护。实际部署结果以交接回执为准。
