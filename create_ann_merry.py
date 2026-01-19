import os
import random
import string
from datetime import datetime

# ==========================================
# 1. 案件設定 (共有シート等の情報を正確に反映)
# ==========================================
CONF = {
    '案件名': 'Ann Merry',            # [cite: 4, 30]
    '代表者名': '星 萌華',            # [cite: 4, 80]
    '担当者名': '鈴木',               # [cite: 263, 264]
    'ドメイン': 'ann-merry.com',      # [cite: 32]
    'ユーザー名': 'annmerry1209',     # [cite: 56]
    '受注日': '20260115',             # [cite: 3]
    'メール': 'annmerry.1209@gmail.com', # [cite: 4]
    '事業者番号': 'T1234567890123'    # [cite: 264]
}

# ==========================================
# 2. パス・フォルダ設定
# ==========================================
# デスクトップのRUNBIRDフォルダ内に作成
BASE_PROJECT_DIR = os.path.join(os.path.expanduser("~"), "Desktop", "RUNBIRD", f"[{CONF['受注日']}]_{CONF['案件名']}")

def generate_password(length=20):
    """強力なパスワードを生成"""
    chars = string.ascii_letters + string.digits + "!@#$%^&*()"
    return ''.join(random.choice(chars) for _ in range(length))

def create_project_all_in_one():
    print(f"🚀 {CONF['案件名']} のセットアップを開始します（担当: {CONF['担当者名']}）...")
    
    # 納品用のパスワードを自動生成
    customer_password = generate_password()
    CONF['パスワード'] = customer_password

    # フォルダ・ファイル構造の定義
    structure = {
        "01_制作前": {
            "01_案件定義書.md": f"""# 案件定義書: {CONF['案件名']}
- 受注日: {CONF['受注日']} [cite: 3]
- 制作担当: {CONF['担当者名']} 
- 代表者名: {CONF['代表者名']} 様 [cite: 4]
- 所在地: 宮城県仙台市青葉区北山3丁目1-30 1階 [cite: 4]

## 対策キーワード (MEO) [cite: 6]
- 青葉区 トリミング
- 仙台 トリミング
- 青葉区 ペットサロン""",
            "02_構成案.md": f"# サイト構成案\n- イメージ: 親しみ・優しい・清潔感 [cite: 57]\n- テーマ: Lightning [cite: 126]\n- 参考: Figoo.jp",
            "03_ヒアリング補足.md": "# 注意点\n- 代表は人見知りなタイプ。誘導して提案する。 [cite: 4]\n- 店名は愛犬アンと実家の犬メリーから。 [cite: 4]"
        },
        
        "02_制作中": {
            ".cursorrules": f"""# 制作ルール
- WordPressテーマ「Lightning」を使用する [cite: 126, 185]
- デザインは Figoo.jp を参考に「丸み・清潔感」を出す
- 担当者は {CONF['担当者名']} として振る舞う""",
            "Assets/": None,
            "Draft/": None
        },
        
        "03_制作後・納品": {
            "01_お客様確認依頼.txt": f"""【お客様への確認依頼案】
{CONF['代表者名']} 様

お世話になっております、株式会社ランバードの{CONF['担当者名']}です。
サイトの制作が完了いたしました。動作確認をお願いいたします。

■ログインURL
https://{CONF['ドメイン']}/wp-admin/

■ユーザー名
{CONF['ユーザー名']} [cite: 56]

■パスワード
{customer_password}

上記にてログインいただき、ご確認をお願いいたします。""",

            "02_ランバート報告案.txt": f"""【ランバート事務局への報告案】
お疲れ様です、{CONF['担当者名']}です。 
{CONF['案件名']}様の制作完了報告です。

■サイトURL
https://{CONF['ドメイン']}/

■共通管理者ログイン情報 
ID: rbweb
PASS: bizcloud0531

■お客様用ログイン情報
お客様用ID: {CONF['ユーザー名']} [cite: 56]
お客様用パスワード: {customer_password}

制作完了の旨、{CONF['代表者名']}様にもご連絡済みです。""",

            "03_上司への請求準備.txt": f"""【上司への請求準備報告】
案件名: {CONF['案件名']}
ドメイン: {CONF['ドメイン']}
事業者番号: {CONF['事業者番号']} [cite: 264]
※金額は確認中。"""
        }
    }

    # 物理的なフォルダとファイルの作成
    for folder, files in structure.items():
        folder_path = os.path.join(BASE_PROJECT_DIR, folder)
        os.makedirs(folder_path, exist_ok=True)
        if files:
            for file_name, content in files.items():
                target_path = os.path.join(folder_path, file_name)
                if file_name.endswith("/"):
                    os.makedirs(target_path, exist_ok=True)
                else:
                    with open(target_path, "w", encoding="utf-8") as f:
                        f.write(content)

    print(f"✅ 完了！フォルダが作成されました。")

if __name__ == "__main__":
    create_project_all_in_one()
