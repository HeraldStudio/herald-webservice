#### 统一请求成功返回格式
```
HTTP/1.1 200 OK
{
  "success": true,
  "code": 200,
  "result": { json对象包含接口返回结果 }
}
```

#### 统一请求失败返回格式
```
HTTP/1.1 200 OK
{
  "success": false,
  "code": xxx, // 错误代码
  "reason": "可以直接展示给用户的错误原因"
}
```

下文中：
* 所有成功示例均指代 result 的内容
