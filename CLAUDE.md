# karin-runrun (みえるんタイマー)

子供向けのビジュアルタイマーアプリ。HTML/CSS/JavaScriptのフロントエンドのみで構成。

## 画像生成ツール

Gemini APIを使った画像生成スクリプトが `tools/generate_image.py` にある。

### 使い方

```bash
python tools/generate_image.py --prompt "description" --output images/filename.png
```

### オプション
- `--prompt`, `-p`: 画像生成プロンプト（必須）
- `--output`, `-o`: 出力ファイルパス（必須）
- `--aspect`, `-a`: アスペクト比（1:1, 3:4, 4:3, 9:16, 16:9, 3:2, 2:3）デフォルト: 1:1
- `--model`, `-m`: モデル名。デフォルト: gemini-3-pro-image-preview

### 注意
- APIキーは `.env` の `GOOGLE_API_KEY` に設定済み
- `.env` と `tools/` は `.gitignore` で除外されている
- `images/` に保存された画像はプロジェクトアセットとしてコミット対象
