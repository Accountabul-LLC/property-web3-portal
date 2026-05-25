import React, { useEffect } from "react";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, ExternalLink, AlertTriangle, Phone } from "lucide-react";
import { MO_COUNTY_FRAUD_ALERTS } from "@/data/moCountyFraudAlerts";

const PAGE_TITLE = "Missouri Deed Fraud Protection — Free Alerts by County";
const PAGE_DESC =
  "Free deed and title fraud alerts for Missouri homeowners. Sign up directly with your county Recorder of Deeds — St. Louis City, St. Louis County, and statewide.";

const DeedProtection = () => {
  useEffect(() => {
    document.title = PAGE_TITLE;
    const setMeta = (name: string, content: string) => {
      let tag = document.querySelector(`meta[name="${name}"]`);
      if (!tag) {
        tag = document.createElement("meta");
        tag.setAttribute("name", name);
        document.head.appendChild(tag);
      }
      tag.setAttribute("content", content);
    };
    setMeta("description", PAGE_DESC);

    const canonicalHref = `${window.location.origin}/protection/deed-fraud`;
    let canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.setAttribute("rel", "canonical");
      document.head.appendChild(canonical);
    }
    canonical.setAttribute("href", canonicalHref);
  }, []);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: PAGE_TITLE,
    description: PAGE_DESC,
    about: MO_COUNTY_FRAUD_ALERTS.map((c) => ({
      "@type": "GovernmentOffice",
      name: c.recorder,
      areaServed: c.name,
      url: c.signupUrl,
    })),
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <main className="max-w-5xl mx-auto px-4 py-12 space-y-12">
        {/* Hero */}
        <header className="space-y-4 text-center">
          <Badge variant="secondary" className="mx-auto">
            <ShieldCheck className="w-3 h-3 mr-1" /> Missouri
          </Badge>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight bg-gradient-primary bg-clip-text text-transparent">
            Protect your property from deed fraud
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Most Missouri counties offer a free service that emails you the moment any
            document is recorded against your property or name. It takes about two minutes
            to sign up — and it's the single best defense against title theft.
          </p>
        </header>

        {/* Explainer */}
        <section className="grid md:grid-cols-3 gap-4">
          <Card className="p-6 space-y-2">
            <AlertTriangle className="w-5 h-5 text-primary" />
            <h2 className="font-semibold">What deed fraud looks like</h2>
            <p className="text-sm text-muted-foreground">
              A scammer forges a quitclaim deed transferring your home to themselves,
              then takes out a loan or tries to sell it. Owners often don't find out for
              months.
            </p>
          </Card>
          <Card className="p-6 space-y-2">
            <ShieldCheck className="w-5 h-5 text-primary" />
            <h2 className="font-semibold">How alerts protect you</h2>
            <p className="text-sm text-muted-foreground">
              Your county Recorder of Deeds emails you whenever a new document is filed
              under your name — so you can catch a fraudulent recording within hours, not
              months.
            </p>
          </Card>
          <Card className="p-6 space-y-2">
            <Badge variant="outline" className="text-xs">Free</Badge>
            <h2 className="font-semibold">No middleman, no fees</h2>
            <p className="text-sm text-muted-foreground">
              These services are run directly by your county. We don't collect your data
              — we just point you to the right place.
            </p>
          </Card>
        </section>

        {/* County list */}
        <section className="space-y-4">
          <h2 className="text-2xl font-bold">Sign up by county</h2>
          <p className="text-sm text-muted-foreground">
            Pick the county where your property is located. The link opens the official
            signup page run by that county's Recorder of Deeds.
          </p>

          <div className="grid md:grid-cols-2 gap-4">
            {MO_COUNTY_FRAUD_ALERTS.map((county) => (
              <Card key={county.slug} className="p-6 flex flex-col gap-3">
                <div>
                  <h3 className="font-semibold text-lg">{county.name}</h3>
                  <p className="text-xs text-muted-foreground">{county.recorder}</p>
                </div>
                <p className="text-sm text-muted-foreground flex-1">
                  {county.description}
                </p>
                {county.phone && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Phone className="w-3 h-3" /> {county.phone}
                  </p>
                )}
                <Button asChild className="w-full mt-2">
                  <a
                    href={county.signupUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Sign up — free, ~2 minutes
                    <ExternalLink className="w-4 h-4 ml-2" />
                  </a>
                </Button>
              </Card>
            ))}
          </div>
        </section>

        {/* Trust footer */}
        <section className="text-center text-sm text-muted-foreground border-t border-border pt-8">
          <p>
            Accountabul is not affiliated with the Missouri Recorder of Deeds offices or
            Property Fraud Alert. We provide this page as a public service to help
            Missouri property owners find the protection that already exists.
          </p>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default DeedProtection;
