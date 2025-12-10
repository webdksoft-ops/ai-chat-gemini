/** @type {import('next').NextConfig} */
const nextConfig = {
    // Cấu hình này áp dụng cho các API Routes (server-side)
    webpack: (config, { isServer }) => {
        // Chỉ áp dụng cho server-side code (API Routes)
        if (isServer) {
            // Đánh dấu các gói này là "external" để Node.js xử lý
            config.externals.push('@google/genai', '@google-cloud/text-to-speech');
        }
        return config;
    },
};

module.exports = nextConfig;
