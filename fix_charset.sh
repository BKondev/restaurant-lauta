sed -i '29a\
// Set UTF-8 charset for JavaScript files\
app.use((req, res, next) => {\
    if (req.path.endsWith(".js")) {\
        res.setHeader("Content-Type", "application/javascript; charset=UTF-8");\
    }\
    next();\
});' /opt/resturant-website/server.js
