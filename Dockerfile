# 親イメージとして公式イメージを使う
FROM node:current

# 作業用（working）ディレクトリを指定
WORKDIR /usr/src/app

# ホスト上のファイルを現在の場所にコピー
COPY package.json .

# イメージのファイルシステム内でコマンドを実行
RUN yarn install

# 実行時、コンテナが特定のポートをリッスンするよう Docker に通知
EXPOSE 8080

# コンテナ内で指定したコマンドを実行
CMD [ "yarn", "serve" ]

# 残りのソースコードをホスト上からイメージのファイルシステム上にコピー
COPY . .