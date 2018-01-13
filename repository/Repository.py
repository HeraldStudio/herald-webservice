# 【示例】from .collections.user import User
class Repository(object):
    def __init__(self, db):
        self.db = db
        # 【示例】self.user = User(self.db)
