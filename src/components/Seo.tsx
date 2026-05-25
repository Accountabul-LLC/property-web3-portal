import { useEffect } from "react";

const SITE_URL = "https://property-web3-portal.lovable.app";

interface SeoProps {
  title: string;
  description: string;
  path: string;
  noindex?: boolean;
}

function setMeta(selector: string, attr: string, value: string, create: () => HTMLElement) {
  let el = document.head.querySelector<HTMLElement>(selector);
  if (!el) {
    el = create();
    document.head.appendChild(el);
  }
  el.setAttribute(attr, value);
}

export const Seo = ({ title, description, path, noindex }: SeoProps) => {
  useEffect(() => {
    const url = `${SITE_URL}${path}`;
    document.title = title;

    const ensureMeta = (key: string, attr: "name" | "property", value: string) => {
      let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
      if (!el) {
        el = document.createElement("meta");
        el.setAttribute(attr, key);
        document.head.appendChild(el);
      }
      el.setAttribute("content", value);
    };

    ensureMeta("description", "name", description);
    ensureMeta("og:title", "property", title);
    ensureMeta("og:description", "property", description);
    ensureMeta("og:url", "property", url);
    ensureMeta("twitter:title", "name", title);
    ensureMeta("twitter:description", "name", description);
    ensureMeta("robots", "name", noindex ? "noindex,nofollow" : "index,follow");

    let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.setAttribute("rel", "canonical");
      document.head.appendChild(canonical);
    }
    canonical.setAttribute("href", url);
  }, [title, description, path, noindex]);

  return null;
};
