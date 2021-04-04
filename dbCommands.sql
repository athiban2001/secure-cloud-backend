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

SELECT g.id,g.name,m.name as manager_name,m.email 
FROM groups g,managers m 
WHERE g.group_manager_id=m.id OFFSET 0 LIMIT 100;

SELECT g.id,g.name,m.name as manager_name,m.email
FROM groups g,managers m 
WHERE g.group_manager_id=m.id AND g.id=1 OFFSET 0 LIMIT 100;

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