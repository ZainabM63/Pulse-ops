<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Incident;
use App\Models\Service;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DashboardController extends Controller
{
    public function __invoke(Request $request): JsonResponse
    {
        $companyId = $request->user()->company_id;

        $activeIncidents = Incident::where('company_id', $companyId)
            ->whereNotIn('status', ['resolved', 'postmortem'])
            ->count();

        $criticalCount = Incident::where('company_id', $companyId)
            ->where('severity', 'critical')
            ->whereNotIn('status', ['resolved', 'postmortem'])
            ->count();

        $majorCount = Incident::where('company_id', $companyId)
            ->where('severity', 'major')
            ->whereNotIn('status', ['resolved', 'postmortem'])
            ->count();

        $byStatus = Incident::where('company_id', $companyId)
            ->whereNotIn('status', ['resolved', 'postmortem'])
            ->selectRaw('status, count(*) as count')
            ->groupBy('status')
            ->pluck('count', 'status');

        $servicesDegraded = Service::where('company_id', $companyId)
            ->where('status', '!=', 'operational')
            ->count();

        $servicesTotal = Service::where('company_id', $companyId)->count();

        return response()->json([
            'active_incidents' => $activeIncidents,
            'critical_count' => $criticalCount,
            'major_count' => $majorCount,
            'by_status' => $byStatus,
            'services_degraded' => $servicesDegraded,
            'services_total' => $servicesTotal,
        ]);
    }
}
