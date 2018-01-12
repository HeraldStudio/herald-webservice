from handler.base import BaseHandler

class IndexHandler(BaseHandler):
    async def get(self):
        self.finish_success()
