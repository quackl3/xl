import bcrypt from 'bcrypt';
import { Pool } from '@neondatabase/serverless';

async function resetAdminPassword() {
  // Configurar conexión a la base de datos
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  
  try {
    // Hash de la nueva contraseña
    const newPassword = 'balonx';
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);
    
    // Actualizar la contraseña en la base de datos
    const result = await pool.query(
      'UPDATE users SET password = $1 WHERE username = $2',
      [hashedPassword, 'balonx']
    );
    
    if (result.rowCount > 0) {
      console.log('Contraseña del administrador balonx actualizada exitosamente');
      console.log('Nueva contraseña: balonx');
    } else {
      console.log('No se encontró el usuario balonx');
    }
  } catch (error) {
    console.error('Error al actualizar la contraseña:', error);
  } finally {
    await pool.end();
  }
}

resetAdminPassword();