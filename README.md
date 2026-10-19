# MiniCraft
three.js + WebSocket のMinecraft風マルチプレイ・ボクセルゲーム(Node.js + `ws` のみ)。

## 主な機能
- 複数ワールド(名前+シードで作成、`data/<名前>.json` に保存)/ バイオーム(平原・砂漠・雪原・森・海)/ 洞窟・溶岩
- ブロック13種(TNT・水・溶岩・レッドストーンブロック・雪など)/ インベントリ
- ゲームモード: クリエイティブ / サバイバル(ハート・落下/溶岩/爆発/PvPダメージ)/ スペクテイター
- スニーク(Shift、端から落ちない)/ スマホ・タブレット用タッチ操作 / 天気(雨)
- チャットとコマンド(`T` または `/`): `/tp` `/give` `/gamemode` `/weather` `/seed` `/coords` `/kill` `/heal` `/clear` `/op` `/help`
- キャラクリ / 頭上ネームタグ / 座標コピー(`C` キー、`/coords`、設定画面)

## 起動
```bash
npm install && npm start    # http://localhost:3000
```

## 環境変数
| 名前 | 説明 |
|---|---|
| `SEED` | 新規ワールド作成時の既定シード(空ならランダム) |
| `ADMIN_KEY` | 設定すると、シード変更(`/seed 値`・設定画面)に `/op キー` が必要になる |
| `DATA_DIR` | ワールド保存先(Render Disk のマウント先など) |

## Render
GitHubにpush → New Web Service(Build `npm install` / Start `node server.js` / Health `/healthz`)。
無料プランのファイルは一時的で、再起動でワールドが消えます。
