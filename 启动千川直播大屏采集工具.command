#!/bin/zsh
cd "$(dirname "$0")" || exit 1

if [ ! -d node_modules ]; then
  echo "正在安装依赖，第一次会慢一点..."
  ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/ npm install || {
    echo "依赖安装失败。"
    read "REPLY?按回车退出..."
    exit 1
  }
fi

npm run dev
