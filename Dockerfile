# Builds the site and serves it with `vite preview` on port 4173, to check a
# production build locally. The deployed site is built by
# .github/workflows/pages.yml, not from this image.
#
# Keep the Node major in sync with .node-version.
# Dependabot updates the digest only; bump the major by hand.
FROM node:26-slim@sha256:e6bedef217677b276c591795e169840edd9096dbf13f29df8ef8d1856b8820bc

# Keep the pnpm major in sync with pnpm/action-setup in .github/workflows/*.yml.
RUN npm install -g pnpm@12

USER node
WORKDIR /home/node/app

# Install dependencies before copying the sources, so this layer is reused
# until the dependencies change.
COPY --chown=node:node package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

COPY --chown=node:node . .
RUN pnpm build

EXPOSE 4173
CMD ["pnpm", "preview", "--host", "0.0.0.0", "--port", "4173", "--strictPort"]
