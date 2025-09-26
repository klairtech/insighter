/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",

  // SSR and Performance Optimizations
  compress: true,
  poweredByHeader: false,

  // External packages for server components
  serverExternalPackages: ["pg", "@supabase/supabase-js"],

  // Turbopack configuration (moved from experimental)
  turbopack: {
    rules: {
      "*.svg": {
        loaders: ["@svgr/webpack"],
        as: "*.js",
      },
    },
  },

  // Experimental Features for Performance
  experimental: {
    optimizeCss: true,
    optimizePackageImports: ["react-icons", "lucide-react"],
    serverMinification: true,
    serverSourceMaps: false,
  },

  // Image optimization
  images: {
    domains: ["localhost"],
    formats: ["image/webp", "image/avif"],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 60,
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    unoptimized: process.env.NODE_ENV === "development", // Only for development
  },

  // Environment variables
  env: {
    CUSTOM_KEY: process.env.CUSTOM_KEY,
  },

  // Webpack configuration for bundle optimization
  webpack: (config, { buildId, dev, isServer, defaultLoaders, webpack }) => {
    // Bundle Analyzer (when ANALYZE env var is set)
    if (process.env.ANALYZE === "true" && !isServer) {
      const { BundleAnalyzerPlugin } = require("webpack-bundle-analyzer");
      config.plugins.push(
        new BundleAnalyzerPlugin({
          analyzerMode: "server",
          openAnalyzer: true,
          analyzerPort: 8889,
          generateStatsFile: true,
          statsFilename: "bundle-stats.json",
        })
      );
    }

    // Optimize bundle splitting for better caching
    if (!isServer) {
      config.optimization.splitChunks = {
        chunks: "all",
        cacheGroups: {
          default: false,
          vendors: false,
          // Vendor chunk for large libraries
          vendor: {
            name: "vendor",
            chunks: "all",
            test: /node_modules/,
            priority: 20,
          },
          // Common chunk for shared code
          common: {
            name: "common",
            minChunks: 2,
            chunks: "all",
            priority: 10,
            reuseExistingChunk: true,
            enforce: true,
          },
          // Supabase chunk
          supabase: {
            name: "supabase",
            test: /[\\/]node_modules[\\/]@supabase[\\/]/,
            chunks: "all",
            priority: 30,
          },
          // React chunk
          react: {
            name: "react",
            test: /[\\/]node_modules[\\/](react|react-dom)[\\/]/,
            chunks: "all",
            priority: 40,
          },
        },
      };
    }

    return config;
  },

  // Headers for caching, security, and performance
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "origin-when-cross-origin",
          },
          {
            key: "X-DNS-Prefetch-Control",
            value: "on",
          },
        ],
      },
      {
        source: "/api/:path*",
        headers: [
          {
            key: "Access-Control-Allow-Origin",
            value: process.env.CORS_ORIGINS || "http://localhost:3000",
          },
          {
            key: "Access-Control-Allow-Methods",
            value: "GET, POST, PUT, DELETE, OPTIONS",
          },
          {
            key: "Access-Control-Allow-Headers",
            value: "Content-Type, Authorization",
          },
          {
            key: "Cache-Control",
            value: "public, max-age=300, s-maxage=300",
          },
        ],
      },
      {
        source: "/_next/static/(.*)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        source: "/favicon.ico",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=86400",
          },
        ],
      },
    ];
  },

  // Redirects
  async redirects() {
    return [
      {
        source: "/home",
        destination: "/",
        permanent: true,
      },
    ];
  },

  // Rewrites for API routes
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "/api/:path*",
      },
    ];
  },
};

module.exports = nextConfig;
