import { DOMAIN_METADATA } from "./siteMetadata";

/** Inline at build/dev transform time; crawlers still receive server-rendered tags. */
export function renderSiteMetadataBootstrap(): string {
  const catalog = JSON.stringify(DOMAIN_METADATA).replace(/</g, "\\u003c");
  return `(function(){
    var h=location.hostname.toLowerCase(), catalog=${catalog}, m=catalog[h], d=document;
    if(!m) return;
    // Public CMS marketing pages retain their own saved metadata and canonical.
    if(/^(www\\.)?(allaboutultrasound|iheartecho)\\.(com|net)$/.test(h)||h==='site.allaboutultrasound.com') return;
    function set(sel,key,value,tag){
      var nodes=d.querySelectorAll(sel), el=nodes[0];
      if(!el){el=d.createElement(tag||'meta');var match=sel.match(/\\[([^=]+)="([^"]+)"\\]/);if(match)el.setAttribute(match[1],match[2]);d.head.appendChild(el);}
      for(var i=1;i<nodes.length;i++)nodes[i].remove();
      el.setAttribute(key,value);
    }
    set('link[rel="icon"]','href',m.favicon,'link');
    set('link[rel="apple-touch-icon"]','href',m.favicon,'link');
    set('meta[name="theme-color"]','content',m.themeColor);
    set('meta[name="apple-mobile-web-app-title"]','content',m.appTitle);
    if(d.documentElement.getAttribute('data-page-seo')==='1') return;
    var canonical=location.origin+location.pathname;
    d.title=m.title;
    set('meta[name="description"]','content',m.description);
    set('meta[name="keywords"]','content',m.keywords||'');
    set('meta[property="og:title"]','content',m.title);
    set('meta[property="og:description"]','content',m.description);
    set('meta[property="og:type"]','content','website');
    set('meta[property="og:image"]','content',m.image);
    set('meta[property="og:site_name"]','content',m.siteName);
    set('meta[property="og:url"]','content',canonical);
    set('meta[name="twitter:card"]','content','summary_large_image');
    set('meta[name="twitter:title"]','content',m.title);
    set('meta[name="twitter:description"]','content',m.description);
    set('meta[name="twitter:image"]','content',m.image);
    if(m.twitterSite)set('meta[name="twitter:site"]','content',m.twitterSite);
    else d.querySelectorAll('meta[name="twitter:site"]').forEach(function(el){el.remove();});
    ['width','height'].forEach(function(key){var value=m[key==='width'?'imageWidth':'imageHeight'];if(value)set('meta[property="og:image:'+key+'"]','content',String(value));else d.querySelectorAll('meta[property="og:image:'+key+'"]').forEach(function(el){el.remove();});});
    set('link[rel="canonical"]','href',canonical,'link');
  })();`;
}

export function injectSiteMetadataBootstrap(html: string): string {
  return html.replace("<!-- domain-metadata-bootstrap -->", `<script data-domain-metadata-bootstrap>${renderSiteMetadataBootstrap()}</script>`);
}
