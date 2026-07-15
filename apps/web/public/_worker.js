// Pages advanced-mode worker：把 production pages.dev 301 到正式網域
// （_redirects 不支援跨網域規則，Bulk Redirects 需要 dashboard 權限）
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.hostname === 'hypercerts-guide.pages.dev') {
      url.hostname = 'hypercerts.guide';
      return Response.redirect(url.toString(), 301);
    }
    return env.ASSETS.fetch(request);
  },
};
