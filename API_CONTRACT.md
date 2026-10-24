# API contract v1
Base /api/v1/, JSON, authenticated unless specified. Errors: DRF field/detail errors. Lists paginated using count/next/previous/results. IDs integers. Times milliseconds. Dates ISO 8601 UTC.

POST auth/register/ {username,email,password} → user (student only)
POST auth/login/ {username,password} → {access,user}; sets HttpOnly refresh cookie
POST auth/refresh/ → {access}; rotates refresh cookie (CSRF required)
POST auth/logout/ → 204; invalidates refresh and clears cookie
GET auth/csrf/ initializes CSRF cookie; GET auth/me/ → user
GET categories/?search=; staff POST/PATCH/DELETE categories/<id>/ {name,parent,description,position}
GET materials/?search=&category=; staff POST/PATCH materials/<id>/ {title,category,description,source,license,rights_confirmed}
POST materials/<id>/audio/ multipart {file} → audio metadata
PUT materials/<id>/transcript/ {segments:[{text,speaker,start_ms,end_ms}]} → new draft version
POST materials/<id>/publish/ → published material; requires validated audio, transcript and rights
GET materials/<id>/ → material + permitted transcript/audio metadata
GET audio/<id>/stream/ → private audio bytes; Range supported
GET/POST sessions/ {material,difficulty:easy|medium|hard|full} → session pinned to version, grouped intervals
GET/PATCH sessions/<id>/ {position,draft} → autosave/resume own session
POST sessions/<id>/check/ {answer,position,normalization?} → deterministic word alignment/accuracy, stores original response
GET progress/ → response-derived counts/accuracy/weekly activity/resume/recent materials
GET responses/?mistakes=true → own checked answers and corrections
GET schema/ and docs/ → OpenAPI schema and documentation

Students never see drafts; anonymous users never see private media; staff permissions enforced by API. Mock sessions will not use these unrestricted transcript endpoints.
