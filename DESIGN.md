---
name: 何度目かのプロローグ
description: Notion風の白とグレーのページに、オレンジを一点だけ差す個人ブログ。
colors:
  accent: "#f97316"
  paper: "#ffffff"
  ink: "#18181b"
  ink-soft: "#3f3f46"
  ink-muted: "#52525b"
  line: "#e4e4e7"
  line-faint: "#f4f4f5"
typography:
  display:
    fontFamily: "DM Sans Variable, Noto Sans JP Variable, sans-serif"
    fontSize: "3rem"
    fontWeight: 700
    lineHeight: 1
  headline:
    fontFamily: "DM Sans Variable, Noto Sans JP Variable, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.4
  body:
    fontFamily: "DM Sans Variable, Noto Sans JP Variable, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.75
  label:
    fontFamily: "DM Sans Variable, Noto Sans JP Variable, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: 1.4
  code:
    fontFamily: "JetBrains Mono Variable, monospace"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.6
rounded:
  xs: "2px"
  md: "12px"
spacing:
  xs: "8px"
  sm: "16px"
  md: "24px"
  lg: "48px"
  xl: "64px"
components:
  post-card:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "16px"
  link-card:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
  toc:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink-muted}"
    rounded: "{rounded.md}"
    padding: "16px"
  header:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    height: "64px"
---

# Design System: 何度目かのプロローグ

## Overview

**Creative North Star: "The Quiet Notebook"**

白いページに文字が置かれているだけのように見える、Notion風のミニマルな設計。主役は記事で、UIは目に入らないところまで引く。装飾は持たず、階層はグレーの細い枠線と余白で作る。

オレンジはリンクの下線、フォーカスリング、現在位置の印にだけ使う。文字色にはしない。

**Key Characteristics:**
- 白とzincの階調だけで構成し、色はオレンジ1色のみ
- 階層は枠線が主、影は控えめな補助
- 余白は4の倍数。読む幅を広げすぎない
- 日本語と欧文を同じ`font-sans`で混植する

## Colors

無彩色のzincが画面の9割以上を占め、オレンジが線として数点だけ光る。

### Primary
- **Signal Orange** (#f97316, Tailwind `orange-500`): リンクの下線、フォーカスリング、現在位置の線（ヘッダーの現在ページの下線、目次のアクティブ項目の左線）。選択範囲の背景だけは同系の薄い`orange-100`を使う。

### Neutral
- **Paper White** (#ffffff): ページ背景とカード面。
- **Ink** (#18181b, `zinc-900`): 見出し、本文、リンク文字。
- **Soft Ink** (#3f3f46, `zinc-700`): リード文、補足の本文、ナビゲーション。
- **Muted Ink** (#52525b, `zinc-600`): 日付やメタ情報、目次の非アクティブ項目、リンクカードの説明。
- **Hairline** (#e4e4e7, `zinc-200`): カードと目次とリンクカードの枠線。
- **Faint Hairline** (#f4f4f5, `zinc-100`): ヘッダーとフッターの区切り線、リンクカードの画像背景。

### Named Rules
**The One Spark Rule.** オレンジは線と印にだけ使う。文字色、ボタンの塗り、バッジ、見出し、背景には使わない（`orange-500`の文字は白背景で約2.8:1となり、読めない）。

## Typography

**Display / Body Font:** DM Sans Variable（フォールバック: Noto Sans JP Variable, sans-serif）
**Mono Font:** JetBrains Mono Variable（コードブロック）

**Character:** 欧文はDM Sansの幾何学的な素直さ、和文はNoto Sans JPの標準的な読みやすさ。どちらも主張しない。

### Hierarchy
- **Display** (700, 1.875rem→3rem（lg）, 1): ページタイトル（`h1`）。
- **Headline** (600, 1.25rem, 1.4): セクション見出しとカードタイトル。
- **Body** (400, 1rem, 1.75): 記事本文。`@tailwindcss/typography`で整える。
- **Label** (500, 0.875rem): ナビゲーション、日付、目次。

### Named Rules
**The Mixed-Script Rule.** 和文と欧文でフォントを切り替えない。常に`font-sans`のフォールバック順（DM Sans → Noto Sans JP）で混植する。

## Layout

中央寄せのコンテナ。一覧は`max-w-6xl`、記事本文とAboutは`max-w-3xl`、左右は24px（`px-6`）。一覧は1→2→3列（md/lg）のグリッドで、間隔は16px。記事ページは本文と右側の目次（14rem）の2カラムで、モバイルでは目次が本文の上に出る。ページ冒頭は64〜128pxの余白を取る。余白は4の倍数に統一する。

## Elevation & Depth

階層は影ではなく枠線で表す。カードは1pxの`zinc-200`の枠で囲み、ホバーで枠を`zinc-600`に濃くする。影は添える程度の控えめなものだけを許し、記事内画像の`shadow-sm`が唯一の例。ヘッダーは`white/60`の半透明とぼかしで固定する。

### Named Rules
**The Border-First Rule.** 面を分けるときはまず1pxのグレー枠を使い、足りない場合にだけごく弱い影を足す。

## Shapes

角丸は控えめ。カード、目次、リンクカードは12px（`rounded-xl`）で統一する。フォーカスリングの角だけは2px。ボタン状の要素は持たず、すべて四角い面と細い線で構成する。

## Components

### Post Card
- **Shape:** 12px角丸、1pxの`zinc-200`枠、内側16px
- **Content:** 日付（Muted Ink、小）、タイトル（Headline）、説明（3行まで）
- **Hover:** 枠のみ`zinc-600`へ。背景は変えない

### Table of Contents
- **Shape:** 12px角丸、`zinc-200`枠、内側16px
- **Active:** 左2pxの線が`orange-500`になり、文字が`zinc-900`の中太になる

### Header
- 高さ64px、固定、下に`zinc-100`の線。ロゴは太字、ナビは`zinc-700`でホバー時`zinc-900`
- 現在のページは文字が`zinc-900`になり、2pxのオレンジ下線が付く

### Inline Link
- 文字は周囲と同色（`zinc-900`）で、2pxの`orange-500`の下線（オフセット4px）。ホバーで下線が`orange-600`に濃くなる。記事本文内のリンクも同じ

### Link Card
- 12px角丸、`zinc-200`枠、白背景。ホバーは Post Card と同じく枠が`zinc-600`に濃くなる（背景は変えない）。説明文は`zinc-600`、画像の背景は`zinc-100`。内側16px。480px未満では1列になり、画像（16:9）が上に来る

### Focus Ring
- すべての操作要素で、2pxの`orange-500`アウトライン、オフセット2px

## Do's and Don'ts

### Do:
- **Do** 色の階調は`zinc`系で統一する。
- **Do** 余白と寸法は4の倍数にする。
- **Do** 面の区切りはグレーの1px枠で表す。
- **Do** リンクは下線のオレンジで示す。クラスは`link-inline`。
- **Do** 現在位置は線で示す。

### Don't:
- **Don't** オレンジを文字色、ボタンの塗り、見出し、背景に使わない。
- **Don't** 影で階層を作らない。足す場合も控えめに留める。
- **Don't** 角丸を12pxより大きくしない。
- **Don't** 色コードを直書きしない。zincのスケールを使う。
- **Don't** 装飾（グラデーション、アイコンの飾り、アニメーション演出）を足さない。
