# Admin Check Replacement Plan

## 📊 **Scope of Hard-coded Admin Checks**

| File | Count | Type |
|------|-------|------|
| games.ts | 17 | Mixed (middleware + inline) |
| profiles.ts | 6 | ✅ **COMPLETED** |
| invites.ts | ~8 | Middleware replaceable |
| workouts.ts | ~3 | Middleware replaceable |
| posts.ts | ~2 | Inline checks |
| chat.ts | ~2 | Middleware replaceable |
| reports.ts | ~1 | Middleware replaceable |
| media.ts | ~1 | Middleware replaceable |

## 🔄 **Replacement Patterns**

### **Pattern 1: Simple Middleware Replacement**
**Before:**
```typescript
router.post('/admin/endpoint', requireAuth, async (req, res) => {
  if (req.user!.email !== 'codydearkland@gmail.com') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  // ... rest of function
});
```

**After:**
```typescript
router.post('/admin/endpoint', requireAuth, requireAdmin, async (req, res) => {
  // ... rest of function (remove admin check)
});
```

### **Pattern 2: Inline Admin Checks**
**Before:**
```typescript
const isAdmin = user.email === 'codydearkland@gmail.com';
if (isAdmin) {
  // admin logic
}
```

**After:**
```typescript
const isAdmin = checkAdminPermissions(req);
// OR
if (req.user?.isAdmin) {
  // admin logic
}
```

## 🎯 **Implementation Strategy**

### **Phase 1: Complete Simple Routes (High Impact, Low Risk)**
Files that can be quickly fixed with middleware replacement:
- ✅ **profiles.ts** - COMPLETED
- **invites.ts** - 8 admin routes
- **workouts.ts** - 3 admin routes  
- **chat.ts** - 2 admin routes
- **reports.ts** - 1 admin route
- **media.ts** - 1 admin route

### **Phase 2: Complex Route Logic (Medium Impact, Medium Risk)**
- **games.ts** - 17 mixed patterns (some middleware, some inline)
- **posts.ts** - 2 inline admin checks

### **Phase 3: Admin Management UI (High Impact, New Feature)**
- Create admin management routes
- Frontend admin management interface

## 🚀 **Quick Wins Available Now**

### **games.ts - Routes Ready for Middleware Replacement:**
1. `POST /` - Create game ✅ **COMPLETED**
2. `PATCH /:gameId/score` - Update score ✅ **COMPLETED**  
3. `PATCH /:gameId` - Update game details
4. `DELETE /:gameId` - Delete game
5. `POST /:gameId/share-to-feed` - Share to feed
6. `POST /:gameId/players` - Add player
7. `POST /:gameId/manual-players` - Add manual player
8. `GET /admin/manual-players` - Get manual players
9. `PATCH /admin/manual-players/:id/link` - Link manual player
10. `PATCH /admin/manual-players/:id/unlink` - Unlink manual player

### **games.ts - Routes with Inline Admin Logic:**
1. `GET /my-games` - Line 30: `const isAdmin = user.email === 'codydearkland@gmail.com';`
2. `GET /:gameId/players` - Lines 523, 564: Permission checking logic
3. `POST /:gameId/players/:playerId/stats` - Line 803: Permission checking
4. `DELETE /:gameId/stats/:statId` - Line 1008: Permission checking

## 💡 **Benefits After Completion**

### **Code Quality:**
- **~50 lines removed** across all files
- **Single source of truth** for admin permissions
- **Maintainable** admin management
- **Testable** permission logic

### **Security:**
- **Database-driven** admin permissions
- **No hard-coded emails** in source code
- **Centralized** permission management
- **Audit trail** for admin changes

### **User Experience:**
- **Admin management UI** for adding/removing admins
- **Flexible permission system** for future roles
- **Proper error messages** and feedback

## 📝 **Next Steps**

1. **Run the migration** to add `isAdmin` column
2. **Complete simple middleware replacements** (30 minutes)
3. **Update inline admin checks** (15 minutes)
4. **Create admin management routes** (20 minutes)
5. **Test thoroughly** with existing admin user

**Total estimated time: ~90 minutes for complete admin system overhaul**