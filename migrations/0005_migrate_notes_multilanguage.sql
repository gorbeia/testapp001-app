-- Create oharrak_messages table for multilingual notes support
CREATE TABLE IF NOT EXISTS oharrak_messages (
    id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid(),
    oharrak_id VARCHAR(255) NOT NULL REFERENCES oharrak(id) ON DELETE CASCADE,
    language VARCHAR(10) NOT NULL, -- 'eu', 'es', 'en', etc.
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    
    UNIQUE(oharrak_id, language)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_oharrak_messages_oharrak_id ON oharrak_messages(oharrak_id);
CREATE INDEX IF NOT EXISTS idx_oharrak_messages_language ON oharrak_messages(language);

-- Migrate existing notes to multilanguage structure
INSERT INTO oharrak_messages (oharrak_id, language, title, content)
SELECT 
    id as oharrak_id,
    'eu' as language,
    title,
    content
FROM oharrak
WHERE title IS NOT NULL AND content IS NOT NULL
ON CONFLICT (oharrak_id, language) DO NOTHING;

-- Create Spanish translations for existing notes (basic translations)
INSERT INTO oharrak_messages (oharrak_id, language, title, content)
SELECT 
    id as oharrak_id,
    'es' as language,
    CASE 
        WHEN title = 'Ondo etorri!' THEN '¡Bienvenido!'
        WHEN title = 'Gogoratu: Kontsumoak itxi' THEN 'Recuerda: Cerrar consumos'
        WHEN title = 'Produktu berriak eskuragarri' THEN 'Nuevos productos disponibles'
        WHEN title = 'Sistemaren mantenua' THEN 'Mantenimiento del sistema'
        WHEN title = 'Erreserbak egiteko modua' THEN 'Cómo hacer reservas'
        WHEN title = 'Ordainketa metodoak' THEN 'Métodos de pago'
        WHEN title = 'Laguntza teknikoa' THEN 'Soporte técnico'
        WHEN title = 'Hilabeteko bilera' THEN 'Reunión mensual'
        ELSE title
    END as title,
    CASE 
        WHEN content LIKE '%Txokora ongi etorri!%' THEN '¡Bienvenido al Txoko! Aquí puedes gestionar tus consumos y reservas.'
        WHEN content LIKE '%kontsumoak hilaren amaieran ixtea%' THEN 'Por favor, recuerda cerrar los consumos al final del mes. Así las deudas se calcularán correctamente.'
        WHEN content LIKE '%produktu berriak gehitu dira%' THEN 'Hoy se han añadido nuevos productos: sidra natural y queso de pastor nuevo. ¡Pruébalos!'
        WHEN content LIKE '%sistemaren mantenua egingo da%' THEN 'El miércoles de 22:00 a 23:00 habrá mantenimiento del sistema. El servicio no estará disponible durante ese tiempo.'
        WHEN content LIKE '%Erreserbak egiteko, joan "Erreserbak" atalera%' THEN 'Para hacer reservas, ve a la sección "Reservas" y selecciona fecha y número de personas. Ten en cuenta el precio de cocina por persona.'
        WHEN content LIKE '%banku-transferentziaz egin behar dira%' THEN 'Todos los pagos deben hacerse por transferencia bancaria. Número de cuenta: ESXX XXXX XXXX XXXX XXXX.'
        WHEN content LIKE '%Arazo teknikorik baduzu%' THEN 'Si tienes problemas técnicos, contacta con el administrador: admin@txokoa.eus o 612 345 678.'
        WHEN content LIKE '%Hilabeteko bilera ostegunean%' THEN 'La reunión mensual será el jueves a las 19:00. Para discutir el estado del txoko y las cuentas.'
        ELSE content
    END as content
FROM oharrak
WHERE title IS NOT NULL AND content IS NOT NULL
ON CONFLICT (oharrak_id, language) DO NOTHING;

-- Create function to get note message in user's preferred language
CREATE OR REPLACE FUNCTION get_oharrak_message(oharrak_uuid VARCHAR, preferred_lang VARCHAR DEFAULT 'eu')
RETURNS TABLE(title VARCHAR, content TEXT) AS $$
BEGIN
    RETURN QUERY
    SELECT om.title, om.content
    FROM oharrak_messages om
    WHERE om.oharrak_id = oharrak_uuid
      AND om.language = preferred_lang
    LIMIT 1;
    
    -- If no translation found for preferred language, try fallback to 'eu'
    IF NOT FOUND THEN
        RETURN QUERY
        SELECT om.title, om.content
        FROM oharrak_messages om
        WHERE om.oharrak_id = oharrak_uuid
          AND om.language = 'eu'
        LIMIT 1;
    END IF;
    
    -- If still no translation found, return any available language
    IF NOT FOUND THEN
        RETURN QUERY
        SELECT om.title, om.content
        FROM oharrak_messages om
        WHERE om.oharrak_id = oharrak_uuid
        LIMIT 1;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Note: We keep the old title and content columns in oharrak table for now
-- They can be dropped in a future migration after confirming the migration worked correctly
