<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\NotificationResource;
use App\Models\UserNotification;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class NotificationController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $notifications = UserNotification::with(['incident', 'actor'])
            ->where('user_id', $request->user()->id)
            ->latest()
            ->paginate($request->integer('per_page', 30));

        return response()->json([
            'data' => NotificationResource::collection($notifications),
            'meta' => [
                'unread_count' => UserNotification::where('user_id', $request->user()->id)
                    ->whereNull('read_at')
                    ->count(),
            ],
        ]);
    }

    public function read(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'ids' => ['nullable', 'array'],
            'ids.*' => ['integer'],
            'all' => ['nullable', 'boolean'],
        ]);

        $query = UserNotification::where('user_id', $request->user()->id)
            ->whereNull('read_at');

        if ($request->boolean('all')) {
            $query->update(['read_at' => now()]);
        } elseif (!empty($validated['ids'])) {
            $query->whereIn('id', $validated['ids'])->update(['read_at' => now()]);
        }

        return response()->json([
            'message' => 'Notifications marked as read',
            'unread_count' => UserNotification::where('user_id', $request->user()->id)
                ->whereNull('read_at')
                ->count(),
        ]);
    }
}