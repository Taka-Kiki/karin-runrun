# family-local-guide

家庭内向けの「近所の小児科・保育園・緊急連絡先」まとめサイトの最小テンプレートです。

## ファイル構成

- `index.html`: 画面構成
- `style.css`: 見た目
- `script.js`: データ読み込み・表示・検索
- `data.json`: 編集するデータ本体（小児科/保育園/緊急連絡先）

## ローカル起動（PowerShell）

このフォルダで次を実行:

```powershell
python -m http.server 8080
```

ブラウザでアクセス:

`http://localhost:8080`

## データ更新方法

`data.json` を編集すると表示内容が変わります。

- `pediatrics`: 小児科
- `nurseries`: 保育園
- `emergency`: 困ったときの連絡先

各項目は次の形です:

```json
{
  "name": "施設名や連絡先名",
  "area": "地域",
  "phone": "電話番号",
  "note": "メモ"
}
```

## 代替コマンド（Python未導入時）

Node.js がある場合:

```powershell
npx serve .
```
