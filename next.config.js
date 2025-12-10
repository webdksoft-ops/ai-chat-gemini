const nextConfig = {
    webpack: (config, { isServer }) => {
        if (isServer) {
            config.externals.push(
                '@google/genai',
                // Thêm gói TTS vào externals luôn
                '@google-cloud/text-to-speech' 
            );
        }
        return config;
    },
};

module.exports = nextConfig;
