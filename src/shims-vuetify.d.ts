declare module "vuetify";
declare module "vuetify/lib/components";
declare module "vuetify/lib/directives";
import Vuetify from "@/plugins/vuetify";

declare module "@vue/runtime-core" {
  interface ComponentCustomProperties {
    $vuetify: Vuetify;
  }
}
