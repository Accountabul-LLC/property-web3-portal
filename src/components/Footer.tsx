import React from 'react';

const Footer = () => {
  const currentYear = new Date().getFullYear();

  const footerLinks = {
    Platform: [
      { label: "Real Estate Marketplace", href: "#" },
      { label: "Tokenize Property", href: "#" },
      { label: "Professional Marketplace", href: "#" },
      { label: "Portfolio Dashboard", href: "#" }
    ],
    Support: [
      { label: "Help Center", href: "#" },
      { label: "AI Assistant", href: "#" },
      { label: "Contact Us", href: "#" },
      { label: "Community Forum", href: "#" }
    ],
    Membership: [
      { label: "Get Membership", href: "#" },
      { label: "Benefits", href: "#" },
      { label: "Pricing", href: "#" },
      { label: "NFT Collection", href: "#" }
    ],
    Legal: [
      { label: "Privacy Policy", href: "#" },
      { label: "Terms of Service", href: "#" },
      { label: "Compliance", href: "#" },
      { label: "Security", href: "#" }
    ]
  };

  return (
    <footer className="bg-card border-t border-border">
      <div className="max-w-7xl mx-auto px-4 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8">
          {/* Logo and Description */}
          <div className="lg:col-span-1 space-y-4">
            <div className="flex items-center space-x-2">
              <img 
                src="/lovable-uploads/96df3864-7d22-4373-883e-b2a5cb11778d.png" 
                alt="Accountabul Logo" 
                className="w-8 h-8"
              />
              <span className="text-xl font-bold bg-gradient-primary bg-clip-text text-transparent">
                Accountabul
              </span>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Empowering Ownership. Elevating Community. Built on Blockchain.
            </p>
            <p className="text-xs text-muted-foreground">
              Tokenize, invest, and manage real estate portfolios with transparent blockchain technology.
            </p>
          </div>

          {/* Footer Links */}
          {Object.entries(footerLinks).map(([category, links]) => (
            <div key={category} className="space-y-4">
              <h3 className="font-semibold text-sm">{category}</h3>
              <ul className="space-y-2">
                {links.map((link, index) => (
                  <li key={index}>
                    <a 
                      href={link.href}
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom Bar */}
        <div className="mt-12 pt-8 border-t border-border flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
          <div className="text-sm text-muted-foreground">
            © {currentYear} Accountabul. All rights reserved.
          </div>
          <div className="flex items-center space-x-4 text-sm text-muted-foreground">
            <span>Built on XRPL</span>
            <span>•</span>
            <span>Verified & Secure</span>
            <span>•</span>
            <span>Community Governed</span>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;