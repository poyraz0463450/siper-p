import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../prismaClient';

export const register = async (req: Request, res: Response) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            res.status(400).json({ error: 'Kullanıcı adı ve şifre gereklidir.' });
            return;
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const user = await prisma.user.create({
            data: {
                username,
                password_hash: hashedPassword,
                role: 'user', // Default role
            },
        });

        res.status(201).json({ message: 'Kullanıcı başarıyla oluşturuldu.', userId: user.id });
    } catch (error) {
        res.status(500).json({ error: 'Kullanıcı oluşturulurken hata oluştu. Kullanıcı adı alınmış olabilir.' });
    }
};

export const login = async (req: Request, res: Response) => {
    try {
        const { username, password } = req.body;

        const user = await prisma.user.findUnique({ where: { username } });

        if (!user) {
            res.status(400).json({ error: 'Kullanıcı bulunamadı.' });
            return;
        }

        const validPassword = await bcrypt.compare(password, user.password_hash);

        if (!validPassword) {
            res.status(400).json({ error: 'Hatalı şifre.' });
            return;
        }

        const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, process.env.JWT_SECRET as string, {
            expiresIn: '24h',
        });

        res.json({ token, user: { id: user.id, username: user.username, role: user.role } });
    } catch (error) {
        res.status(500).json({ error: 'Giriş yapılırken hata oluştu.' });
    }
};
