# 部署说明（muyutxd1.com）

> ⚠️ 本次重写**改变了运行方式**：应用入口从仓库根目录 `app.py` 迁到了 `backend/app.py`，
> 并新增了前端构建产物 `backend/static_spa/`。**服务器端的启动命令/工作目录必须随之更新**，
> 不能只 `git pull` 就重启旧服务（旧的 `gunicorn app:app` 已不存在）。

## 结构
```
mysite/
  backend/        # Flask 纯 JSON API + 托管 SPA
    app.py        # create_app()，wsgi.py 暴露 app
    wsgi.py       # gunicorn 入口：wsgi:app
    api/ calculators/ core/ data/
    requirements.txt
    static_spa/   # 前端构建产物（Flask 托管，见下）
  frontend/       # Vite + React 源码（仅构建期需要 Node）
  _legacy/        # 旧 Flask+Jinja 代码（仅参照，可后续删除）
```
生产：**单进程** gunicorn 跑 `backend/wsgi:app`，Flask 同时托管 `static_spa/` 静态产物和 `/api/*`。
React Router 深链由 catch-all 兜底到 `index.html`。无需 Node 运行时（仅构建时需要）。

## 一次性：构建前端 → 产出 static_spa
需要 Node 18+（仅构建用）。二选一：

**A. 在服务器上构建**（服务器有 Node）
```bash
cd frontend
npm ci
npm run build        # 产物输出到 ../backend/static_spa
```

**B. 本地构建后上传**（服务器无 Node，推荐）
```bash
# 本地
cd frontend && npm ci && npm run build
# 然后把 backend/static_spa/ 整个目录上传到服务器对应位置（rsync/scp）
```
> 注：`backend/static_spa/` 默认在 .gitignore 中。若希望 `git pull` 即带产物，
> 可改为提交它（去掉 .gitignore 该行，本地构建后提交）。

## 后端依赖
```bash
cd backend
pip install -r requirements.txt    # flask, gunicorn, sympy（与旧版相同，无新增）
```

## 启动（gunicorn，工作目录 = backend/）
```bash
cd /path/to/mysite/backend
gunicorn -w 4 -b 127.0.0.1:5000 wsgi:app
```

### systemd 示例（替换路径/用户）
```ini
# /etc/systemd/system/muyusite.service
[Unit]
Description=muyutxd1.com Flask SPA
After=network.target

[Service]
User=www-data
WorkingDirectory=/path/to/mysite/backend
ExecStart=/path/to/venv/bin/gunicorn -w 4 -b 127.0.0.1:5000 wsgi:app
Restart=always

[Install]
WantedBy=multi-user.target
```
```bash
sudo systemctl daemon-reload && sudo systemctl restart muyusite
```

### nginx（若有反代，通常无需改动 location）
```nginx
location / { proxy_pass http://127.0.0.1:5000; proxy_set_header Host $host; }
```
Flask 已处理静态资源与 SPA 兜底，nginx 直接全量反代即可（也可让 nginx 直接 `alias` 到
`backend/static_spa` 提速静态资源，可选）。

## 日常部署流程（结构稳定后）
```bash
cd /path/to/mysite
git pull
cd frontend && npm ci && npm run build   # 或本地构建上传 static_spa
cd ../backend && pip install -r requirements.txt
sudo systemctl restart muyusite
```

## 数据
`backend/data/` 含题库/知识库/灵占数据，随仓库一起。`backend/data/shares/`（Markdown 分享）
在 .gitignore，运行时自动创建，**部署时勿删**（保留已有分享）。
