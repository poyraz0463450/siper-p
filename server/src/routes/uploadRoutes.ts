import express from 'express';
import multer from 'multer';
import path from 'path';

const router = express.Router();

// Configure storage
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        // We'll save to client's public/assets/parts folder for easy serving
        // Assuming running from server/
        cb(null, path.join(__dirname, '../../../client/public/assets/parts'));
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, 'part-' + uniqueSuffix + ext);
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Sadece resim dosyaları yüklenebilir.'));
        }
    }
});

router.post('/', upload.single('image'), (req, res) => {
    try {
        if (!req.file) {
            // @ts-ignore
            return res.status(400).json({ error: 'Dosya yüklenemedi.' });
        }

        // Return relative path for frontend
        const imageUrl = `/assets/parts/${req.file.filename}`;
        res.json({ imageUrl });
    } catch (error) {
        res.status(500).json({ error: 'Yükleme hatası.' });
    }
});

export default router;
