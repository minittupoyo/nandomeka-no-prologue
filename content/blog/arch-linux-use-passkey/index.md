---
title: ArchLinuxでパスキーを使う
description: ArchLinuxでパスキーを使えるようにするためのメモ
date: 2026-09-08T12:57:00.000Z
tags: []
draft: false
---

## パスキー

スマホでQRコードを読み取ってログインできたりするアレです。

ArchLinuxだとデフォルトで使えないので、使えるようにするまでの手順を残しておきます。

## パッケージ入れる

```shell
sudo pacman -S libfido2 bluez
```

必要なのはこの2つだけです。多分。

## bluetoothの有効化

```shell
sudo systemctl enable --now bluetooth
```

これで準備OKです。

## 終わり

もう終わりです。ブラウザとかを再起動すれば使えるようになってるはず！
