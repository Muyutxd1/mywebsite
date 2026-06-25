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

## Render（本站使用 · 自动部署）

Render 在推送到所连分支（通常 `main`）时自动构建+部署。本次结构变更后，需在
**Render 控制台 → 你的服务 → Settings → Build & Deploy** 改两条命令
（前端产物 `backend/static_spa/` 已随仓库提交，**Render 无需 Node**）：

| 字段 | 值 |
|---|---|
| Root Directory | 留空（仓库根） |
| Build Command | `pip install -r backend/requirements.txt` |
| Start Command | `gunicorn --chdir backend -w 2 --timeout 60 -b 0.0.0.0:$PORT wsgi:app` |

要点：
- `$PORT` 由 Render 注入，必须绑 `0.0.0.0:$PORT`（旧的 `app.run(5000)` 仅本地用）。
- `--chdir backend` 让 gunicorn 在 `backend/` 下跑，`wsgi:app` 即 `backend/wsgi.py` 的 `app`。
- 免费 512MB 内存若吃紧，把 `-w 2` 降到 `-w 1`（题库会按需缓存解析过的大 JSON）。
- 想让 Render 自行构建前端则需 Node 环境，不推荐——已提交产物即可。

**上线顺序（避免一次失败部署）**：
1. 先在 Render 改好上面两条命令并保存。
2. 把 `rewrite-spa` 合并进 `main` 推送 → 触发自动部署。
3. Render 构建(pip)→启动(gunicorn)→新站上线。失败则保留上一个成功版本，线上不中断。

---

## 一次性：构建前端 → 产出 static_spa（仅在你想自行构建时）
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
