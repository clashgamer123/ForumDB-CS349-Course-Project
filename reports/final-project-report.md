# ForumDB Final Project Report

## 1. Project Overview

ForumDB is a Reddit-style community forum application built with a Flask backend, PostgreSQL database, and React frontend. The application supports user authentication, community discovery, public and private communities, posting with media, comments and nested replies, voting, profiles, following, private-profile approval, messaging, and sharing posts or communities through messages.

The system is designed around three main ideas:

1. Communities organize discussion.
2. Posts and comments create threaded forum content.
3. User relationships control profile privacy and messaging access.

The final version supports:

- User signup, login, logout, and session-based authentication.
- Public and private communities.
- Joining and leaving communities.
- Viewing and posting directly in public communities.
- Private-community access only after joining.
- Home feed ranked by selected sort mode.
- Home feed inclusion for joined communities and public communities the user has visited.
- Binary visited-community priority, without ranking by number of visits.
- Hot, New, Top, Rising, and Controversial sorting.
- Following-only home-feed filter.
- Search for posts, communities, and users.
- User profile pages with profile picture, bio, display name, location, and privacy setting.
- Follow requests for private users.
- Messaging users after accepted follow.
- Messages with text, images, videos, post shares, and community shares.
- Post creation with title, media first, then context.
- Media previews that preserve aspect ratio and open in a large viewer.
- Post previews that show title and media only.
- Voting on posts and comments.
- Deleting own posts and comments.

Comment sharing was removed in the final cleanup. Only posts and communities can be shared in messages.

## 2. Technology Stack

### Backend

- Flask: REST API framework.
- Flask-CORS: Allows the React frontend to call the backend with credentials.
- psycopg2: PostgreSQL connection and query execution.
- Werkzeug security helpers: Password hashing and password verification.
- PostgreSQL: Relational database and full-text search support.

### Frontend

- React: Component-based user interface.
- React Router: Page routing for home, communities, posts, profiles, create post, and messages.
- Vite: Development server and production build tooling.
- CSS modules by feature file: Each major screen has its own CSS file.

### Deployment/Runtime

- Docker Compose runs:
  - PostgreSQL database.
  - Flask backend on port `5000`.
  - React frontend on port `3000`.

## 3. Database Design

The database schema is defined in `database/init.sql`. The backend also includes a defensive `ensure_schema` function in `backend/app/db_control/db.py` so existing local databases receive newer columns and tables without needing a full reset.

### `users`

Stores account and profile data.

Important columns:

- `id`: Primary key.
- `username`: Unique public username.
- `email`: Unique login email.
- `hash_password`: Secure hashed password.
- `bio`: User biography.
- `profile_pic_url`: Uploaded profile image URL.
- `is_private`: Whether the user's profile content is hidden until follow approval.
- `display_name`: Optional profile display name.
- `location`: Optional profile location.
- `created_at`: Account creation timestamp.

### `communities`

Stores forum communities.

Important columns:

- `id`: Primary key.
- `name`: Unique community handle.
- `display_name`: Human-readable name.
- `description`: Community description.
- `is_private`: Controls public/private access.
- `created_by`: User who created the community.
- `members_count`: Cached member count.
- `created_at`: Creation timestamp.

Private communities require joining before viewing posts or posting. Public communities can be opened and posted in without joining.

### `community_members`

Many-to-many relationship between users and communities.

Primary key:

- `(community_id, user_id)`

This table decides whether a user has joined a community.

### `user_community_visits`

Tracks whether a user has visited a public community.

Important columns:

- `user_id`
- `community_id`
- `visit_count`
- `last_visited_at`

The final home feed only uses this as a binary signal: visited or not visited. It does not sort by `visit_count`, so Hot, Top, Controversial, Rising, and New remain meaningful.

### `posts`

Stores forum posts.

Important columns:

- `id`: Primary key.
- `title`: Post title.
- `content`: Post context/body.
- `author_id`: User who wrote the post.
- `community_id`: Community containing the post.
- `created_at`: Creation timestamp.
- `search_vector`: PostgreSQL generated full-text-search vector from title and content.

### `post_media`

Stores images and videos attached to posts.

Important columns:

- `post_id`: Parent post.
- `media_type`: MIME type such as `image/jpeg` or `video/mp4`.
- `media_url`: Uploaded file URL.
- `position`: Display order.
- `caption`: Optional caption.

### `comments`

Stores comments and nested replies.

Important columns:

- `id`: Primary key.
- `post_id`: Parent post.
- `author_id`: Comment author.
- `parent_comment_id`: Null for top-level comments, otherwise points to another comment.
- `content`: Comment body.
- `created_at`: Timestamp.

Nested comments are represented by `parent_comment_id`.

### `post_votes` and `comment_votes`

Store user votes.

Important columns:

- Target ID: `post_id` or `comment_id`.
- `user_id`: Voting user.
- `vote_value`: Either `1` or `-1`.
- `created_at`: Timestamp.

The primary key prevents duplicate votes by the same user on the same target.

### `user_follows`

Stores follow relationships.

Important columns:

- `follower_id`: User who follows.
- `following_id`: User being followed.
- `status`: `pending` or `accepted`.
- `created_at`
- `updated_at`

Public users can be followed immediately. Private users create a pending request that must be accepted.

### `messages`

Stores private messages.

Important columns:

- `sender_id`
- `recipient_id`
- `content`
- `media_url`
- `media_type`
- `share_type`: `post` or `community`.
- `share_id`: ID of the shared post or community.
- `created_at`

Messages can include text, media, or a shared post/community. Comment sharing is not allowed in the final version.

## 4. Backend Architecture

The Flask app is created in `backend/app/__init__.py`.

### `create_app`

Creates and configures the Flask application.

Responsibilities:

- Loads app config.
- Sets `SECRET_KEY`.
- Sets upload size limit.
- Enables CORS for `http://localhost:3000`.
- Initializes database teardown handling.
- Registers route blueprints:
  - `/api/auth`
  - `/api/communities`
  - `/api/posts`
  - `/api/media`
  - `/api/users`
  - `/api/messages`
- Adds `/api/health`.
- Serves uploaded files from `/uploads/<filename>`.

## 5. Database Connection Layer

File: `backend/app/db_control/db.py`

### `get_db`

Creates or returns the current request's PostgreSQL connection.

Workflow:

1. Checks Flask `g` for an existing connection.
2. If none exists, creates a new `psycopg2` connection.
3. Uses `RealDictCursor` so query results behave like dictionaries.
4. Runs `ensure_schema` once per process.
5. Returns the connection.

### `ensure_schema`

Keeps older local databases compatible with newer code.

It adds missing columns and tables such as:

- Profile fields on `users`.
- `is_private` on `communities`.
- `user_follows`.
- `user_community_visits`.
- `messages`.

It also updates message constraints so only posts and communities can be shared.

### `close_db`

Closes the database connection at the end of a request.

### `init_app`

Registers `close_db` with Flask's teardown lifecycle.

## 6. Authentication Routes

File: `backend/app/routes/auth.py`

### `signup`

Creates a new user.

Workflow:

1. Reads username, email, and password from JSON.
2. Hashes the password with Werkzeug.
3. Inserts the user into `users`.
4. Logs the user in by setting `session['user_id']`.
5. Returns the new user.

### `login`

Authenticates a user.

Workflow:

1. Finds user by username.
2. Compares submitted password with stored hash.
3. Sets `session['user_id']` on success.
4. Returns the logged-in user's ID and username.

### `is_logged_in`

Checks whether the current browser session is authenticated.

Used by React on app startup.

### `logout`

Removes `user_id` from the session.

## 7. Community Routes

File: `backend/app/routes/communities.py`

### `is_community_member`

Checks whether a user has joined a community.

### `record_community_visit`

Records that a user opened a community page.

The table increments `visit_count`, but home feed ranking only checks if a row exists. This keeps the "visited community" signal without letting frequent visits override Hot/Top/etc.

### `annotate_communities`

Adds user-specific metadata to communities:

- `is_joined`
- `visit_count`

### `get_all_communities`

Returns all communities for browsing.

### `get_my_communities`

Returns communities joined by the logged-in user.

### `get_single_community`

Loads one community.

Access behavior:

- Public community: anyone logged in can open it.
- Private community: only joined users can open it.
- Opening a public community records a visit.

### `create_community`

Creates a community.

Supports:

- Name.
- Display name.
- Description.
- Public/private setting.

The creator is automatically inserted into `community_members`.

### `update_community`

Lets the creator change community privacy.

### `join_community`

Adds the user to `community_members` and increments `members_count`.

### `leave_community`

Removes the user from `community_members` and decrements `members_count`.

### `search_communities`

Performs basic case-insensitive community search.

## 8. Post and Comment Routes

File: `backend/app/routes/posts.py`

### Access Helpers

#### `fetch_community_access`

Fetches community privacy and whether the user joined.

#### `can_access_community`

Returns whether a user can access a community:

- Public: allowed.
- Private and joined: allowed.
- Private and not joined: blocked.

### Sorting Helpers

#### `normalize_sort_mode`

Accepts requested sort mode and falls back to `hot` if invalid.

Valid modes:

- `hot`
- `new`
- `top`
- `rising`
- `controversial`

#### `build_post_order_clause`

Builds the SQL `ORDER BY` expression for the selected feed mode.

Important behavior:

- Search results include search rank first.
- Home feed can add binary visited-community priority.
- The selected ranking still controls ordering inside those groups.

### Media Helpers

#### `fetch_post_media`

Loads media for one post.

#### `attach_media_to_posts`

Efficiently loads media for a list of posts and attaches each media list to its post object.

### Vote Helpers

#### `fetch_vote_stats`

Computes:

- Upvote count.
- Downvote count.
- Total score.
- Current user's vote.

#### `apply_vote`

Handles vote toggling.

Behavior:

- Same vote again removes vote.
- Opposite vote updates vote.
- No existing vote inserts new vote.

### Comment Helpers

#### `fetch_comments_for_post`

Uses a recursive SQL query to fetch nested comments and vote data.

#### `build_comment_tree`

Converts flat recursive query results into nested comment objects with `replies`.

### `fetch_posts_listing`

Central post-list query used by:

- Home feed.
- Community page.
- Profile page.
- Following-only feed.

It can filter by:

- Search query.
- Community.
- Author.
- Joined communities.
- Home-visible communities.
- Followed authors.

Home visibility includes:

- Joined communities.
- Public communities the user has visited.

Following-only mode includes posts from accepted followed users while still respecting private-community access.

### `search_home_communities`

Searches communities from the Home page.

Uses:

- PostgreSQL full-text search.
- `ILIKE` fallback matching.
- Member count and creation date for ordering.

### `create_post`

Creates a post.

Access behavior:

- Public community: posting allowed without joining.
- Private community: posting requires membership.

Media items are inserted into `post_media` after the post is created.

### `get_home_feed`

Returns home feed posts and matching communities.

Query parameters:

- `sort`: Ranking mode.
- `q`: Search query.
- `filter`: `all` or `following`.

### `get_community_posts`

Returns posts inside one community.

Private communities require membership.

### `get_single_post`

Returns one post with media, author, community, votes, and comment count.

Private-community posts require membership.

### `get_post_comments`

Returns nested comments for a post.

Private-community comments require membership.

### `create_comment`

Creates a top-level comment or reply.

Validates:

- User is logged in.
- Content is not empty.
- Post exists.
- Parent comment belongs to same post.
- User can access the post's community.

### `delete_post`

Deletes a post only if the logged-in user is the author.

### `delete_comment`

Deletes a comment only if the logged-in user is the author.

### `vote_on_post`

Applies an upvote or downvote to a post.

### `vote_on_comment`

Applies an upvote or downvote to a comment.

## 9. Media Routes

File: `backend/app/routes/media.py`

### `upload_media`

Uploads images and videos.

Workflow:

1. Requires login.
2. Checks that a file was submitted.
3. Validates file extension.
4. Saves the file into `/app/uploads`.
5. Prefixes filename with user ID.
6. Returns:
   - `media_url`
   - `media_type`
   - `filename`

Supported extensions:

- Images: `png`, `jpg`, `jpeg`, `gif`
- Videos: `mp4`, `mov`, `avi`

## 10. User and Follow Routes

File: `backend/app/routes/users.py`

### `fetch_user_comments`

Returns recent comments by a user with vote stats and post/community metadata.

### `can_view_user`

Controls private profile visibility.

Access is allowed when:

- Viewer is the same user.
- Profile is public.
- Viewer follows the private user with `accepted` status.

### `add_follow_meta`

Adds relationship metadata to a user object:

- Default profile picture.
- Whether it is the current user's own profile.
- Follow status from viewer to target.
- Follower count.
- Following count.

### `get_my_profile`

Returns the logged-in user's full profile, posts, comments, and pending follow requests.

### `update_my_profile`

Updates:

- Bio.
- Profile picture.
- Private/public profile setting.
- Display name.
- Location.

### `get_public_profile`

Returns another user's profile.

If the profile is private and the viewer is not accepted, posts and comments are hidden.

### `search_users`

Searches users by username.

Used by:

- Home user search.
- Message user search.
- Share recipient search.

### `follow_user`

Creates or updates a follow relationship.

Behavior:

- Public target: status becomes `accepted`.
- Private target: status becomes `pending`.

### `unfollow_user`

Removes the follow relationship.

### `respond_to_follow_request`

Accepts or rejects pending follow requests for private profiles.

## 11. Message Routes

File: `backend/app/routes/messages.py`

### `can_message_user`

Returns true when the sender follows the recipient with `accepted` status.

### `get_threads`

Returns previous message conversations for the logged-in user.

Each thread includes:

- Other user's ID.
- Username.
- Profile picture.
- Last message timestamp.
- Last message summary.

### `get_thread`

Returns messages between the current user and one other user.

Also returns whether the current user can send messages to that user.

### `send_message`

Sends a message.

Allowed message content:

- Text.
- Image/video media.
- Shared post.
- Shared community.

Rules:

- Sender must be logged in.
- Recipient must exist.
- Sender must follow recipient with accepted status.
- Comment shares are rejected.

## 12. Frontend Architecture

The frontend lives in `frontend/src`.

### `App.jsx`

Top-level router.

Routes:

- `/login`: Authentication.
- `/`: Home feed.
- `/communities`: Community browser.
- `/c/:id`: Community page.
- `/posts/:id`: Post detail page.
- `/u/me`: Current user's profile.
- `/u/:username`: Public/private user profile.
- `/create`: Create post page.
- `/messages`: Message inbox.
- `/messages/:userId`: Direct message thread.

On startup, `App` calls `/api/auth/isLoggedIn` and stores the user in React state.

### `Navbar.jsx`

Displays:

- ForumDB brand.
- Home Feed.
- Communities.
- Create Post.
- Messages.
- Current user profile link.
- Logout button.

### `AuthPage.jsx`

Handles login and signup.

Login sends:

- Username.
- Password.

Signup sends:

- Username.
- Email.
- Password.

Successful auth updates app user state.

## 13. Home Feed

File: `HomeFeed.jsx`

The Home feed supports:

- Post sorting.
- Search.
- Community results.
- User results.
- Follow/unfollow/request actions.
- Following-only filter.
- Voting.
- Media preview.

### Feed Sorts

The sort buttons call the backend with `sort`.

Supported modes:

- Hot.
- Rising.
- Controversial.
- Top.
- New.

### Feed Filter

The filter buttons call the backend with `filter`.

Options:

- `all`: Joined communities plus visited public communities.
- `following`: Posts by followed users.

### Search Workflow

When a search query is entered:

1. Home feed requests `/api/posts/feed`.
2. It also requests `/api/users/search`.
3. Matching communities appear.
4. Matching users appear with follow buttons.
5. Matching posts appear.

### Post Preview Format

Home post cards show:

- Community.
- Author link.
- Title.
- Media preview.
- Voting and comment count.

They intentionally do not show post context/description.

## 14. Community Browser

File: `Communities.jsx`

Supports:

- Listing joined communities.
- Listing discoverable communities.
- Searching communities.
- Creating communities.
- Choosing public/private during creation.
- Joining/leaving communities.

Public communities can be opened directly. Private communities show their privacy badge and require joining.

## 15. Community Page

File: `CommunityPage.jsx`

Supports:

- Viewing public/private status.
- Joining.
- Creating posts.
- Searching posts inside the community.
- Sorting posts inside the community.
- Voting.
- Opening posts.
- Sharing the community in messages.

### Create Post Form

The form order is:

1. Title.
2. Image/video upload.
3. Media preview.
4. Context textarea.
5. Submit button.

This matches the requirement that context is written after any images/videos.

## 16. Create Post Page

File: `CreatePostPage.jsx`

This is the global create-post route from the navbar.

Workflow:

1. Loads all communities.
2. Lets the user choose a community.
3. Shows whether the selected community is public or private.
4. Blocks posting to private communities unless joined.
5. Uploads images/videos.
6. Shows media preview.
7. Submits post.
8. Navigates to the new post.

## 17. Post Detail Page

File: `PostPage.jsx`

Displays:

- Community link.
- Author profile link.
- Title.
- Media viewer.
- Context/body.
- Vote controls.
- Comment count.
- Share post button.
- Delete post button if the current user owns it.
- Comments and replies.

### Comment Features

Users can:

- Add top-level comments.
- Reply to comments.
- Vote on comments.
- Delete own comments.
- Open commenter profile by clicking username.

Comment sharing is intentionally removed.

## 18. Profile Page

File: `ProfilePage.jsx`

Supports own profile and other user profiles.

Own profile supports:

- Editing display name.
- Editing bio.
- Editing location.
- Uploading profile picture.
- Making profile private/public.
- Viewing follow requests.
- Accepting/rejecting follow requests.

Other user profile supports:

- Follow.
- Request follow for private users.
- Cancel request.
- Unfollow.
- Message when follow status is accepted.

Private profiles hide posts/comments until follow is accepted.

## 19. Messages Page

File: `MessagesPage.jsx`

Supports:

- Conversation list.
- Previous messaged users.
- Search users.
- Open a thread.
- Send text messages.
- Send image/video messages.
- View shared posts/communities.

Messaging is allowed when the sender follows the recipient and that follow is accepted.

## 20. Media Viewer

File: `MediaViewer.jsx`

Used by:

- Home feed.
- Community page.
- Create post page.
- Post detail page.

Behavior:

- Displays images and videos without cropping important content.
- Uses contained scaling to preserve aspect ratio.
- Allows multiple media items.
- Opens large lightbox view when clicked.

This prevents loss of clarity and avoids distorted image/video previews.

## 21. ShareBox

File: `ShareBox.jsx`

Used for:

- Sharing posts.
- Sharing communities.

Workflow:

1. User clicks Share.
2. Search box opens.
3. User searches followed users.
4. Selecting a user sends a message containing the shared item.

Comment sharing has been removed.

## 22. Main User Workflows

### Signup/Login

1. User opens the app.
2. If not logged in, they are redirected to `/login`.
3. User signs up or logs in.
4. Backend stores session cookie.
5. Frontend routes become available.

### Create Community

1. User opens `/communities`.
2. Clicks Create Community.
3. Enters handle, display name, description.
4. Chooses public or private.
5. Backend inserts community and automatically joins creator.

### Browse Public Community

1. User opens a public community.
2. Backend records the visit.
3. Posts are shown without requiring join.
4. Future home feed can include that community because it was visited.

### Browse Private Community

1. User opens a private community.
2. If not joined, backend blocks post access.
3. User must join.
4. Once joined, posts are visible and posting is allowed.

### Home Feed

1. User opens Home.
2. Backend returns posts from joined communities and visited public communities.
3. Visited communities get a binary priority group.
4. Selected sorting mode controls ranking.
5. User can switch to Following only.

### Follow Private User

1. User searches for another user.
2. If profile is private, button says Request.
3. Backend creates pending follow.
4. Private user sees request on profile.
5. Private user accepts.
6. Follower can now see profile content and message that user.

### Message User

1. User opens Messages.
2. Searches a user or opens an existing thread.
3. If follow is accepted, message sending is allowed.
4. User can send text/media or shared posts/communities.

### Create Post With Media

1. User opens `/create` or community create form.
2. Selects community.
3. Adds title.
4. Uploads images/videos.
5. Writes context after media.
6. Submits post.

### Delete Own Content

1. Post author can delete their post.
2. Comment author can delete their comment.
3. Backend checks ownership before deletion.

## 23. Security and Access Control

Implemented controls:

- Passwords are hashed, never stored as plain text.
- Session cookie stores only `user_id`.
- Most write routes require login.
- Private communities require membership.
- Private profiles require accepted follow.
- Messaging requires accepted follow.
- Delete routes require ownership.
- Upload route requires login.
- Message sharing only allows post/community share types.

## 24. Search

Search exists in several areas:

- Home post search.
- Home community search.
- Home user search.
- Community-specific post search.
- Message user search.
- Share recipient search.

Post and community search use PostgreSQL full-text search plus `ILIKE` matching.

User search uses `ILIKE` on usernames.

## 25. Ranking

Post sorting is calculated in SQL.

### Hot

Combines score strength and post age.

### New

Orders by most recent post.

### Top

Orders by score and comments.

### Rising

Rewards recent engagement while reducing old-post dominance.

### Controversial

Rewards posts with both upvotes and downvotes.

### Visited Community Priority

Home feed adds a binary visited-community group:

- `1`: community was visited by the user.
- `0`: not visited.

It does not use the number of visits. This avoids damaging the selected ranking mode.

## 26. Verification

The project was checked with:

```powershell
npm.cmd run build
```

Result:

- Frontend production build passed.

```powershell
$env:PYTHONDONTWRITEBYTECODE='1'; python -m compileall -q backend\app
```

Result:

- Backend Python files compiled successfully.

Docker Compose was also used during development to run:

- Database.
- Backend.
- Frontend.

The app was available at:

```text
http://localhost:3000
```

Backend health endpoint:

```text
http://localhost:5000/api/health
```

## 27. Known Notes

- `ensure_schema` helps local development databases upgrade automatically, but production systems should use formal migrations.
- Uploaded files are stored on local disk under `uploads`.
- Message sharing supports posts and communities only.
- The home feed includes public communities after the user has visited them at least once.
- Following-only feed shows followed-user posts but still respects private community access.

## 28. Conclusion

ForumDB now implements the core requirements of a modern community forum: authenticated users, communities, public/private access control, rich media posts, threaded comments, voting, profiles, follow-based privacy, messaging, and meaningful feed ranking. The final cleanup keeps feed ranking predictable by using visited communities only as a binary priority signal, removes comment sharing, and makes user discovery reachable through search and clickable usernames throughout the app.
