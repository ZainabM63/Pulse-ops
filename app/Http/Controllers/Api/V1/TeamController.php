<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\TeamResource;
use App\Models\Team;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class TeamController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        return TeamResource::collection(
            Team::latest()->paginate($request->integer('per_page', 25))
        );
    }

    public function show(Team $team): TeamResource
    {
        return new TeamResource($team);
    }
}
