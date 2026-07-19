/**
 * 跳转到支付网关（易支付 submit.php 等）的浏览器兼容重定向。
 *
 * 问题：iOS Safari 等开启了「阻止跨站跟踪 / ITP」的严格浏览器，会拦截
 * 在 `await fetch()` 异步回调里通过 `window.location.href` / `window.open`
 * 触发的跨站导航，导致用户点了支付却跳不过去。
 *
 * 修复：用真实 <form>（method=GET）提交来完成「首次方导航」——任何浏览器
 * 都不会拦截表单提交。paymentUrl 是带签名的 GET 链接，转成等价 GET 表单
 * 提交即可，请求完全一致。
 */
export function redirectToGateway(paymentUrl: string): void {
  if (!paymentUrl) return;

  // 非浏览器环境（SSR）兜底
  if (typeof document === 'undefined') {
    if (typeof window !== 'undefined') window.location.href = paymentUrl;
    return;
  }

  let url: URL;
  try {
    url = new URL(paymentUrl, window.location.origin);
  } catch {
    // 解析失败则退回原始方式
    window.location.href = paymentUrl;
    return;
  }

  const form = document.createElement('form');
  form.method = 'GET';
  form.action = url.origin + url.pathname;
  form.target = '_self';
  form.acceptCharset = 'UTF-8';

  url.searchParams.forEach((value, key) => {
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = key;
    input.value = value;
    form.appendChild(input);
  });

  document.body.appendChild(form);
  // 提交即触发跨站导航；当前文档会被卸载，无需手动移除节点。
  form.submit();
}
