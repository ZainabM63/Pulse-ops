<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreTeamRequest;
use App\Http\Resources\TeamResource;
use App\Http\Resources\UserResource;
use App\Models\Team;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class TeamController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        return TeamResource::collection(
            Team::with('users')->latest()->paginate($request->integer('per_page', 25))
        );
    }

    public function show(Team $team): TeamResource
    {
        return new TeamResource($team);
    }

    public function store(StoreTeamRequest $request): JsonResponse
    {
        $team = Team::create([
            'company_id' => $request->user()->company_id,
            'name' => $request->name,
            'slug' => $request->slug,
            'description' => $request->description,
        ]);

        if ($request->has('user_ids')) {
            User::whereIn('id', $request->user_ids)
                ->where('company_id', $request->user()->company_id)
                ->update(['team_id' => $team->id]);
        }

        return (new TeamResource($team->load('users')))
            ->response()
            ->setStatusCode(201);
    }

    public function users(Request $request): AnonymousResourceCollection
    {
        $users = User::where('company_id', $request->user()->company_id)
            ->orderBy('name')
            ->get();

        return UserResource::collection($users);
    }
}
