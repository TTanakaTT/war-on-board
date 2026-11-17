# Builds the site and serves it with `vite preview` on port 4173, to check a
# production build locally. The deployed site is built by
# .github/workflows/pages.yml, not from this image.
#
# Keep the Node major in sync with `node-version` in .github/workflows/*.yml.
# Dependabot updates the digest only; bump the major by hand.
FROM node:24-slim@sha256:dc26ae92c9fb15cf6b1d63e20f0944b2efe0f115b20e00be48fb23fceb061c54

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
