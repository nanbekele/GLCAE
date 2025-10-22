import { Mail, Phone, MapPin, Printer } from 'lucide-react';
import { Link } from 'react-router-dom';

const Footer = () => {
  return (
    <footer className="bg-primary text-primary-foreground">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Company Info */}
          <div className="col-span-1 lg:col-span-2">
            <div className="flex items-center space-x-3 mb-4">
              <div className="w-12 h-12 bg-accent rounded-lg flex items-center justify-center">
                <span className="text-accent-foreground font-bold text-2xl">G</span>
              </div>
              <div>
                <div className="text-2xl font-bold">GCAE</div>
                <div className="text-primary-foreground/80">GUBALAFTO Consulting Architects and Engineers PLC</div>
              </div>
            </div>
            <p className="text-primary-foreground/80 mb-4 leading-relaxed">
              A MIDROC Investment Group company, delivering quality architectural, engineering, 
              ICT, and consultancy services with competent professionals and data security since July 2018.
            </p>
            <div className="text-sm text-primary-foreground/60">
              <p className="font-semibold">Vision:</p>
              <p>Leading construction and IT consultancy in East Africa by 2025 E.C</p>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Quick Links</h3>
            <ul className="space-y-2">
              {[
                { name: 'About Us', href: '/about' },
                { name: 'Departments', href: '/departments' },
                { name: 'Projects', href: '/projects' },
                { name: 'Careers', href: '/careers' },
                { name: 'News', href: '/news' },
                { name: 'Contact', href: '/contact' },
              ].map((link) => (
                <li key={link.name}>
                  <Link
                    to={link.href}
                    className="text-primary-foreground/80 hover:text-accent transition-colors"
                  >
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact Info */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Contact Info</h3>
            <div className="space-y-3">
              <div className="flex items-start space-x-3">
                <Phone size={16} className="mt-1 text-accent" />
                <div className="text-sm text-primary-foreground/80">
                  <div>+251 11 551 4821</div>
                  <div>+251 94 155 1444</div>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <Printer size={16} className="mt-1 text-accent" />
                <div className="text-sm text-primary-foreground/80">
                  Fax: +251 11 551 4821
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <Mail size={16} className="mt-1 text-accent" />
                <div className="text-sm text-primary-foreground/80">
                  <div>info@gcae.et</div>
                  <div>gcae.midroc@gmail.com</div>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <MapPin size={16} className="mt-1 text-accent" />
                <div className="text-sm text-primary-foreground/80">
                  Addis Ababa, Ethiopia<br />
                  MIDROC Building
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-primary-foreground/20 mt-8 pt-8 text-center">
          <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
            <div className="text-sm text-primary-foreground/60">
              © 2024 GCAE - GUBALAFTO Consulting Architects and Engineers PLC. All rights reserved.
            </div>
            <div className="text-sm text-primary-foreground/60">
              ISO 9001:2015 Certified | A MIDROC Investment Group Company
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;