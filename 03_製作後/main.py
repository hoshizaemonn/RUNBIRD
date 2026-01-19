import os
import random
import string
from datetime import datetime

# 固定設定
PARENT_FOLDER_NAME = "RUNBIRD"
BASE_DIR = os.path.join(os.path.expanduser("~"), "Desktop", PARENT_FOLDER_NAME)
MY_TAX_NUMBER = "T1234567890123" # ホシザキさんの番号

def generate_password(length=20):
    """強力なパスワードを生成"""
    # 大文字、小文字、数字、記号を含む
    chars = string.ascii_letters + string.digits + "!@#$%^&*()_+-=[]{}|;:,.<>?"
    password = ''.join(random.choice(chars) for _ in range(length))
    return password

def generate_customer_credentials():
    """お客様用のIDとパスワードを発行してconfig.txtに保存"""
    config_path = os.path.join(BASE_DIR, "config.txt")
    
    # config.txtを読み取る
    conf = {}
    if os.path.exists(config_path):
        with open(config_path, "r", encoding="utf-8") as f:
            for line in f:
                if ":" in line:
                    k, v = line.split(":", 1)
                    conf[k.strip()] = v.strip()
    
    # ID（ユーザー名）を生成（指定がなければドメインを使用）
    if "ユーザー名" not in conf or not conf["ユーザー名"]:
        if "ドメイン" in conf and conf["ドメイン"]:
            # ドメインからユーザー名を生成（例: example.com -> example）
            domain = conf["ドメイン"].replace("www.", "").split(".")[0]
            customer_id = domain
        else:
            customer_id = f"customer_{datetime.now().strftime('%Y%m%d')}"
    else:
        customer_id = conf["ユーザー名"]
    
    # パスワードを生成（既存のパスワードがあればそれを使用、なければ新規生成）
    if "パスワード" not in conf or not conf["パスワード"] or conf["パスワード"] == "未設定":
        customer_password = generate_password(20)
    else:
        customer_password = conf["パスワード"]
    
    # config.txtを更新
    config_lines = []
    if os.path.exists(config_path):
        with open(config_path, "r", encoding="utf-8") as f:
            config_lines = f.readlines()
    
    # 既存の設定を更新または追加
    has_username = False
    has_password = False
    new_lines = []
    for line in config_lines:
        if line.strip().startswith("ユーザー名:"):
            new_lines.append(f"ユーザー名: {customer_id}\n")
            has_username = True
        elif line.strip().startswith("パスワード:"):
            new_lines.append(f"パスワード: {customer_password}\n")
            has_password = True
        else:
            new_lines.append(line)
    
    # 存在しない場合は追加
    if not has_username:
        new_lines.append(f"ユーザー名: {customer_id}\n")
    if not has_password:
        new_lines.append(f"パスワード: {customer_password}\n")
    
    # ファイルに書き込む
    with open(config_path, "w", encoding="utf-8") as f:
        f.writelines(new_lines)
    
    print(f"\n✅ お客様用のIDとパスワードを発行しました！")
    print(f"■お客様用ID: {customer_id}")
    print(f"■お客様用パスワード: {customer_password}")
    print(f"\n※config.txtに保存しました。")
    
    return customer_id, customer_password

def load_template(template_path, conf):
    """テンプレートファイルを読み込み、変数を置換する"""
    if not os.path.exists(template_path):
        return None
    
    with open(template_path, "r", encoding="utf-8") as f:
        template = f.read()
    
    # 変数を取得
    domain = conf.get('ドメイン', '')
    username = conf.get('ユーザー名', '')
    password = conf.get('パスワード', '')
    case_name = conf.get('案件名', '')
    representative = conf.get('代表者名', '担当者')
    
    result = template
    
    # URLの置換（httpとhttpsの両方に対応）
    result = result.replace("https://nezouya.com/wp-admin/", f"https://{domain}/wp-admin/")
    result = result.replace("http://nezouya.com/wp-admin/", f"http://{domain}/wp-admin/")
    result = result.replace("https://nezouya.com/", f"https://{domain}/")
    result = result.replace("http://nezouya.com/", f"http://{domain}/")
    
    # パスワードの置換（長い特殊文字列なので先に）
    result = result.replace("9wkc(Odf^^OBuZdC&AF5I6le_", password)
    
    # ユーザー名の置換（単独のnezouya行やID行内のnezouyaを置換）
    lines = result.split('\n')
    new_lines = []
    for line in lines:
        if line.strip() == "nezouya":
            # 単独行のnezouya（ユーザー名行）
            new_lines.append(username)
        elif "nezouya" in line:
            # 行内にnezouyaが含まれる場合（ID行など）
            new_lines.append(line.replace("nezouya", username))
        else:
            new_lines.append(line)
    result = '\n'.join(new_lines)
    
    # 案件名の置換
    result = result.replace("寝贈屋様", f"{case_name}様")
    result = result.replace("寝贈屋", case_name)
    
    # 代表者名の置換
    result = result.replace("阿部様", f"{representative}様")
    result = result.replace("阿部", representative)
    
    return result

def run_delivery_tool():
    config_path = os.path.join(BASE_DIR, "config.txt")
    if not os.path.exists(config_path): return print("config.txtが見つかりません")

    # 1. config.txt を読み取る
    conf = {}
    with open(config_path, "r", encoding="utf-8") as f:
        for line in f:
            if ":" in line:
                k, v = line.split(":", 1)
                conf[k.strip()] = v.strip()

    pw = conf.get("パスワード", "未設定")
    name = conf.get("代表者名", "担当者")

    # 2. フォルダ作成
    today = datetime.now().strftime('%Y%m%d')
    folder_name = f"{conf.get('ユーザー名')}_{today}"
    project_path = os.path.join(BASE_DIR, folder_name)
    os.makedirs(project_path, exist_ok=True)

    # 3. テンプレートを読み込む
    line_template_step7 = os.path.join(BASE_DIR, "LINEメッセージ案", "01_阿部様_IDパスワード共有.txt")
    line_template_step8 = os.path.join(BASE_DIR, "LINEメッセージ案", "02_中村様_制作完了報告.txt")
    
    # ステップ7: お客様への確認依頼（LINEメッセージ案テンプレートを使用）
    c_msg = load_template(line_template_step7, conf)
    if c_msg is None:
        # フォールバック: テンプレートがない場合は旧形式を使用
        c_msg = f"""【お客様への確認依頼案】

{name} 様

お世話になっております、株式会社ランバードの鈴木です。
サイトの制作が完了いたしました。動作確認をお願いいたします。

■ログインURL
https://{conf.get('ドメイン')}/wp-admin/

■ユーザー名
{conf.get('ユーザー名')}

■パスワード
{pw}

上記にてログインいただき、表示に問題がないかご確認をお願いいたします。
"""
    
    # ステップ8: ランバート事務局への報告（LINEメッセージ案テンプレートを使用）
    l_msg = load_template(line_template_step8, conf)
    if l_msg is None:
        # フォールバック: テンプレートがない場合は旧形式を使用
        l_msg = f"""【ランバート事務局への報告案】

お疲れ様です、鈴木（北斗）です。
{conf.get('案件名')}様の制作完了報告です。

■サイトURL
https://{conf.get('ドメイン')}/

■お客様用ログイン情報
お客様用ID: {conf.get('ユーザー名')}
お客様用パスワード: {pw}
"""
    
    # 03. 上司への請求準備メモ
    b_msg = f"""【上司への請求準備報告】
案件名: {conf.get('案件名')}
ドメイン: {conf.get('ドメイン')}
事業者番号: {MY_TAX_NUMBER}
※金額は確認中。
"""

    # ファイル保存
    file_map = {
        "01_お客様確認依頼.txt": c_msg,
        "02_ランバート報告案.txt": l_msg,
        "03_上司への請求準備.txt": b_msg
    }
    for fn, txt in file_map.items():
        with open(os.path.join(project_path, fn), "w", encoding="utf-8") as f:
            f.write(txt)

    print(f"\n✅ 修正完了！'{folder_name}' フォルダに文章を作成しました。")

if __name__ == "__main__":
    import sys
    
    # コマンドライン引数で機能を選択
    if len(sys.argv) > 1 and sys.argv[1] == "generate":
        # IDとパスワードを発行
        generate_customer_credentials()
    else:
        # 通常の納品ツールを実行
        run_delivery_tool()