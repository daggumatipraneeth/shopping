-- Local-only seed: sample catalog + an admin user (username "admin" / admin123).

insert into public.products (name, category, description, details, price, image_url, stock) values
  ('Pride and Prejudice', 'book', 'Classic novel of manners.', 'Jane Austen · Paperback', 299, 'https://covers.openlibrary.org/b/isbn/9780141439518-L.jpg', 10),
  ('To Kill a Mockingbird', 'book', 'A story of justice in the American South.', 'Harper Lee · Paperback', 349, 'https://covers.openlibrary.org/b/isbn/9780061120084-L.jpg', 8),
  ('Atomic Habits', 'book', 'Small changes, remarkable results.', 'James Clear · Hardcover', 599, 'https://covers.openlibrary.org/b/isbn/9780735211292-L.jpg', 15),
  ('1984', 'book', 'Dystopian classic.', 'George Orwell · Paperback', 250, 'https://covers.openlibrary.org/b/isbn/9780451524935-L.jpg', 12),
  ('Red Flowing Gown', 'dress', 'Flowing gown for special occasions.', 'Sizes S–XL · Georgette', 1499, 'https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=600', 6),
  ('Red Midi Dress', 'dress', 'Elegant midi dress for evenings.', 'Sizes S–L · Crepe', 1999, 'https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?w=600', 4),
  ('Blue Beach Dress', 'dress', 'Breezy wrap dress for the beach.', 'Sizes M–L · Rayon', 3499, 'https://images.unsplash.com/photo-1539008835657-9e8e9680c956?w=600', 3),
  ('White Party Dress', 'dress', 'Fun off-shoulder party dress.', 'Sizes XS–M · Chiffon', 1799, 'https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?w=600', 5),
  ('Floral Summer Dress', 'dress', 'Light floral dress for summer days.', 'Sizes S–XL · Linen', 1199, 'https://images.unsplash.com/photo-1496747611176-843222e1e57c?w=600', 9);

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new)
values ('00000000-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated',
  'admin@shop.admin', extensions.crypt('admin123', extensions.gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}', '{"full_name":"Admin"}', now(), now(), '', '', '', '');

insert into auth.identities (id, user_id, provider_id, identity_data, provider, created_at, updated_at, last_sign_in_at)
values (gen_random_uuid(), 'a0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001',
  '{"sub":"a0000000-0000-0000-0000-000000000001","email":"admin@shop.admin","email_verified":true}', 'email', now(), now(), now());

update public.profiles set is_admin = true where id = 'a0000000-0000-0000-0000-000000000001';
