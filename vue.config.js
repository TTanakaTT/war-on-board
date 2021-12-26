module.exports = {
  publicPath: "/war-on-board/",
  outputDir: "docs",

  pluginOptions: {
    vuetify: {
      // https://github.com/vuetifyjs/vuetify-loader/tree/next/packages/vuetify-loader
    },
  },
  configureWebpack: {
    performance: {
      maxAssetSize: 5000000,
      maxEntrypointSize: 5000000,
    },
  },
};
