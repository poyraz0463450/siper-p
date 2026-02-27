import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function checkUser() {
    try {
        const user = await prisma.user.findUnique({
            where: { username: 'admin' }
        });

        if (user) {
            console.log('User found:', user);
            const isMatch = await bcrypt.compare('admin123', user.password_hash);
            console.log('Password match:', isMatch);
        } else {
            console.log('User "admin" NOT found.');
        }
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}

checkUser();
