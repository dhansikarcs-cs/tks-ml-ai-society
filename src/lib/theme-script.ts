export const THEME_KEY = "tks-theme";

export function themeInitScript() {
  return `(function(){try{var t=localStorage.getItem("${THEME_KEY}");if(t!=="light"&&t!=="dark"){t=window.matchMedia("(prefers-color-scheme: light)").matches?"light":"dark"};document.documentElement.dataset.theme=t;document.documentElement.style.colorScheme=t}catch(e){}})()`;
}
