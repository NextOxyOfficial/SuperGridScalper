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


def download_ea_file(request, filename):
    """Download EA file by filename (for EA Store)"""
    try:
        # Check if it's a request for a specific EA product file
        ea_product = EAProduct.objects.filter(file_name=filename, is_active=True).first()
        
        if ea_product and ea_product.ea_file:
            # Serve the uploaded EA file
            response = FileResponse(ea_product.ea_file.open('rb'), as_attachment=True)
            response['Content-Disposition'] = f'attachment; filename="{filename}"'
            return response
        
        # Fallback to hardcoded EA files in the ea/ directory
        ea_files = {
            'HedgeGridTrailingEA.ex5': 'HedgeGridTrailingEA.ex5',
            'HedgeGridTrailingEA.mq5': 'HedgeGridTrailingEA.mq5',
            'SuperGridScalper_EA.ex5': 'HedgeGridTrailingEA.ex5',
            'SuperGridScalper_EA.mq5': 'HedgeGridTrailingEA.mq5',
            'GoldScalperLite.ex5': 'Mark\'sAIGoldEA.ex5',
            'GoldScalperLite.mq5': 'Mark\'sAIGoldEA.mq5',
        }
        
        # Map requested filename to actual file
        actual_filename = ea_files.get(filename, filename)
        
        # Path to EA file in the ea/ directory
        ea_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 
                              'ea', actual_filename)
        
        if os.path.exists(ea_path):
            response = FileResponse(open(ea_path, 'rb'), as_attachment=True)
            response['Content-Disposition'] = f'attachment; filename="{filename}"'
            return response
        else:
            # Return 404 if file not found
            from django.http import Http404
            raise Http404(f"EA file '{filename}' not found")
            
    except Exception as e:
        from django.http import Http404
        raise Http404(f"Error downloading EA file: {str(e)}")
