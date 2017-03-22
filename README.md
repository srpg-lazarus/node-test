# README #

### 概要 ###

ポータル連携用ダミーnode

[動作環境構築](https://github.com/srpg-lazarus/machine-ubuntu1604)

### 初期設定 ###

動作環境構築が済んだものとする


```
#!zsh

cd node-test
npm install
vim app.js // MySQLユーザを設定
forever start app.js

```
