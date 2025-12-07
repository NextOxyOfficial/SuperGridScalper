from django.shortcuts import render, redirect
from django.contrib.auth import authenticate, login as auth_login, logout as auth_logout
from django.contrib.auth.decorators import login_required
from django.contrib import messages
from django.http import FileResponse, Http404
from .models import License, EASettings, TradeData
from decimal import Decimal
import os


def user_login(request):
    """User login page"""
    if request.user.is_authenticated:
        return redirect('dashboard')
    
    if request.method == 'POST':
        username = request.POST.get('username')
        password = request.POST.get('password')
        
        user = authenticate(request, username=username, password=password)
        if user is not None:
            auth_login(request, user)
            return redirect('dashboard')
        else:
            return render(request, 'dashboard/login.html', {'error': 'Invalid credentials'})
    
    return render(request, 'dashboard/login.html')


def user_logout(request):
    """User logout"""
    auth_logout(request)
    return redirect('login')


@login_required(login_url='login')
def dashboard(request):
    """Main dashboard view"""
    try:
        license = License.objects.filter(user=request.user).first()
        if not license:
            messages.error(request, 'No license found. Please subscribe first.')
            return redirect('/')
        
        # Get or create EA settings
        settings, created = EASettings.objects.get_or_create(license=license)
        
        # Get trade data if available
        trade_data = TradeData.objects.filter(license=license).first()
        
        # Calculate days remaining
        days_remaining = license.days_remaining()
        
        context = {
            'license': license,
            'settings': settings,
            'trade_data': trade_data,
            'days_remaining': days_remaining,
        }
        
        return render(request, 'dashboard/index.html', context)
    
    except Exception as e:
        messages.error(request, f'Error loading dashboard: {str(e)}')
        return redirect('/')


# Investment update view removed - lot sizes are now calculated dynamically by EA


@login_required(login_url='login')
def download_ea(request):
    """Download EA file"""
    try:
        license = License.objects.filter(user=request.user).first()
        
        if not license or license.status != 'active':
            messages.error(request, 'Active license required to download EA.')
            return redirect('dashboard')
        
        # Path to EA file
        ea_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 
                              'ea', 'HedgeGridTrailingEA.ex5')
        
        # If compiled EA doesn't exist, try the source file
        if not os.path.exists(ea_path):
            ea_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 
                                  'ea', 'HedgeGridTrailingEA.mq5')
        
        if os.path.exists(ea_path):
            response = FileResponse(open(ea_path, 'rb'), as_attachment=True)
            response['Content-Disposition'] = f'attachment; filename="SuperGridScalper_EA.mq5"'
            return response
        else:
            messages.error(request, 'EA file not found. Please contact support.')
            return redirect('dashboard')
            
    except Exception as e:
        messages.error(request, f'Error downloading EA: {str(e)}')
        return redirect('dashboard')
