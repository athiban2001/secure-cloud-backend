CREATE TABLE users (
	id serial PRIMARY KEY,
	name text,
	email VARCHAR(50) UNIQUE,
	password text
);

CREATE TABLE managers (
	id serial PRIMARY KEY,
	name text,
	email VARCHAR(50) UNIQUE,
	password text
);

CREATE TABLE groups (
	id serial PRIMARY KEY,
	name text,
	p text,
	q text,
	g text,
	group_manager_id integer,
	FOREIGN KEY(id) REFERENCES managers(id)
);

CREATE TABLE requests(
	id serial PRIMARY KEY,
	user_id integer,
	group_id integer,
	Xi text,
	FOREIGN KEY(user_id) REFERENCES users(id),
	FOREIGN KEY(group_id) REFERENCES groups(id),
	joining boolean,
	ok boolean
);

CREATE TABLE members (
	id serial PRIMARY KEY,
	user_id integer,
	group_id integer,
	join_time timestamp,
	"Xik" text,
	FOREIGN KEY(user_id) REFERENCES users(id),
	FOREIGN KEY(group_id) REFERENCES groups(id)
);

CREATE TABLE files (
	id serial PRIMARY KEY,
	user_id integer,
	group_id integer,
	original_filename text,
	storage_filename text,
	file_time timestamp,
	file_size integer,
	is_uploaded boolean,
	FOREIGN KEY(user_id) REFERENCES users(id),
	FOREIGN KEY(group_id) REFERENCES groups(id)
);

DELETE FROM files;
DELETE FROM members;
DELETE FROM requests;
DELETE FROM groups;
DELETE FROM managers;
DELETE FROM users;