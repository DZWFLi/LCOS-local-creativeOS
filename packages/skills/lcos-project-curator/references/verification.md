# 验证

完成 apply 后必须抽查，不是只看命令退出码：

```bash
lcos presentation show <project> <presentationId>   # 成员/层级/emphasis 符合预期
lcos related <project>?entityType=artifact&entityId=<id>  # 关系存在且方向正确
lcos node read <project> <viewId>                    # 内容可读、非空、非碎片
```

验证清单：

```text
节点数合理（不是消息数爆炸）
无 raw 粘贴
provenance 完整（origin=agent）
关系密度合理
没有创建 Run
Presentation 成员含新节点
```
