import React from "react";
import Link from "next/link";
import { Mail, Phone, MapPin, Linkedin, Twitter, Github } from "lucide-react";
import LogoRobust from "./LogoRobust";

const Footer: React.FC = () => {
  return (
    <footer className="bg-black border-t border-white/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Company Info */}
          <div className="col-span-1 md:col-span-2">
            <Link href="/" className="mb-4">
              <LogoRobust variant="white" size="md" showText={true} />
              <span className="text-sm font-google-sans text-white ml-10 -mt-2 block">
                AI-Powered Data Analytics Platform
              </span>
            </Link>
            <p className="text-neutral-300 mb-6 max-w-md">
              Transform complex data into actionable insights with AI-powered
              natural language queries. No SQL knowledge required.
            </p>
            <div className="flex space-x-4">
              <a
                href="#"
                className="text-gray-400 hover:text-blue-400 transition-colors"
              >
                <Linkedin className="w-5 h-5" />
              </a>
              <a
                href="#"
                className="text-gray-400 hover:text-blue-400 transition-colors"
              >
                <Twitter className="w-5 h-5" />
              </a>
              <a
                href="#"
                className="text-gray-400 hover:text-blue-400 transition-colors"
              >
                <Github className="w-5 h-5" />
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-white font-google-sans font-normal mb-4">
              Quick Links
            </h3>
            <ul className="space-y-2">
              <li>
                <Link
                  href="/canvas"
                  className="text-gray-300 hover:text-blue-400 transition-colors"
                >
                  Canvas
                </Link>
              </li>
              <li>
                <Link
                  href="/canvas"
                  className="text-gray-300 hover:text-blue-400 transition-colors"
                >
                  Canvas
                </Link>
              </li>
              <li>
                <Link
                  href="/organizations"
                  className="text-gray-300 hover:text-blue-400 transition-colors"
                >
                  Organizations
                </Link>
              </li>
              <li>
                <Link
                  href="/about-us"
                  className="text-gray-300 hover:text-blue-400 transition-colors"
                >
                  About Us
                </Link>
              </li>
              <li>
                <Link
                  href="/contact-us"
                  className="text-gray-300 hover:text-blue-400 transition-colors"
                >
                  Contact
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact Info */}
          <div>
            <h3 className="text-white font-google-sans font-normal mb-4">
              Contact
            </h3>
            <ul className="space-y-3">
              <li className="flex items-center space-x-2 text-neutral-300">
                <Mail className="w-4 h-4 text-blue-400" />
                <span>hello@insighter.ai</span>
              </li>
              <li className="flex items-center space-x-2 text-neutral-300">
                <Phone className="w-4 h-4 text-blue-400" />
                <span>+1 (555) 123-4567</span>
              </li>
              <li className="flex items-center space-x-2 text-neutral-300">
                <MapPin className="w-4 h-4 text-blue-400" />
                <span>San Francisco, CA</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-white/10 mt-8 pt-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <p className="text-neutral-400 text-sm">
              © 2024 Insighter. All rights reserved.
            </p>
            <div className="flex space-x-6 mt-4 md:mt-0">
              <Link
                href="/privacy"
                className="text-gray-400 hover:text-blue-400 text-sm transition-colors"
              >
                Privacy Policy
              </Link>
              <Link
                href="/terms"
                className="text-gray-400 hover:text-blue-400 text-sm transition-colors"
              >
                Terms of Service
              </Link>
              <Link
                href="/cookies"
                className="text-gray-400 hover:text-blue-400 text-sm transition-colors"
              >
                Cookies Policy
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
